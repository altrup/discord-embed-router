import path from "node:path";
import { match, ParamData, Path } from "path-to-regexp";
import {
	CompiledRoute,
	ResolvedRoute,
	RouteHandler,
	State,
} from "./types/routes";
import { ExtractParams } from "./types/ExtractParams";
import {
	ButtonInteraction,
	Interaction,
	InteractionReplyOptions,
} from "discord.js";
import { BASE_URL, ID_PREFIX } from "./consts";
import { pathToString } from "./helpers/pathToString";

export class EmbedRouter {
	private static usedIdentifiers = new Set<string>();
	private static generateUniqueIdentifier(): string {
		const PUA_START = 0xe000;
		const PUA_END = 0xf8ff;
		let char: string;
		do {
			const codepoint =
				PUA_START + Math.floor(Math.random() * (PUA_END - PUA_START + 1));
			char = String.fromCodePoint(codepoint);
		} while (EmbedRouter.usedIdentifiers.has(char));
		EmbedRouter.usedIdentifiers.add(char);
		return char;
	}

	// Prefix for customIds of RouteButtonBuilders
	private idPrefix;
	getIdPrefix() {
		return this.idPrefix;
	}

	// All added routes
	private routes: CompiledRoute<ParamData>[] = [];

	/**
	 *
	 * @param idPrefix the prefix for RouteButtonBuilder customIds
	 */
	constructor(idPrefix = ID_PREFIX) {
		if (idPrefix.includes("/")) {
			throw new Error(`Prefix can't contain "/": ${idPrefix}`);
		}
		this.idPrefix = `${idPrefix}${EmbedRouter.generateUniqueIdentifier()}`;
	}

	/**
	 * Registers a path with the router
	 *
	 * @param routePath path to match with
	 * @param handler function that generates the message when a path is matched
	 */
	on<P extends Path = Path>(
		routePath: P | P[],
		handler: RouteHandler<ExtractParams<P>>,
	) {
		this.routes.push({
			path: Array.isArray(routePath) ? routePath : [routePath],
			matchFunction: match(routePath),
			handler: handler as RouteHandler<ParamData>,
		});
	}

	/**
	 * Adds a subrouter to the router
	 *
	 * @param routePath path of the router
	 * @param embedRouter router to add at the path
	 */
	use<P extends Path = Path>(routePath: P, embedRouter: EmbedRouter) {
		const pathString = pathToString(routePath);
		for (const route of embedRouter.routes) {
			this.on(
				route.path.map((p) => path.posix.join(pathString, pathToString(p))),
				route.handler,
			);
		}
	}

	/**
	 * Must be attached to "interactionCreate" event for RouteButtonBuilder to work
	 *
	 * @param interaction interactions from "interactionCreate" (filter for ButtonInteractions)
	 */
	async listener(interaction: ButtonInteraction) {
		if (!interaction.isButton()) return;

		const customId = interaction.customId;
		if (!customId.startsWith(this.idPrefix)) return;

		const path = customId.slice(this.idPrefix.length);
		this.dispatch(interaction, path);
	}

	/**
	 * Connect or update an interaction message to a path
	 *
	 * @param interaction interaction to connect to
	 * @param path path to route the interaction to
	 * @param flags optional discord flags to send with message (only allowed on first reply)
	 */
	async dispatch<P extends Path = Path>(
		interaction: Interaction,
		path: P,
		flags?: InteractionReplyOptions["flags"],
	) {
		if (interaction.isAutocomplete())
			throw new Error("Autocomplete Interactions aren't supported");

		// don't check validity because url params are considered invalid
		const resolvedRoute = this.resolve(pathToString(path, false));
		if (!resolvedRoute)
			throw new Error(`No route found for ${pathToString(path, false)}`);

		const routeResponse = resolvedRoute.handler(
			interaction,
			resolvedRoute.state,
		);

		if (interaction.replied || interaction.deferred) {
			if (flags)
				throw new Error(
					"You can only set flags for interactions that haven't been replied to",
				);
			await interaction.editReply(routeResponse);
		} else if ("update" in interaction) {
			if (flags)
				throw new Error(
					"You can only set flags for interactions that haven't been replied to",
				);
			await interaction.update(routeResponse);
		} else {
			interaction.reply({
				...(routeResponse as InteractionReplyOptions),
				flags,
			});
		}
	}

	private resolve<P extends string>(
		routePath: P,
	): ResolvedRoute<ExtractParams<P>> | null {
		const url = new URL(routePath, BASE_URL);
		for (const route of this.routes) {
			const result = route.matchFunction(url.pathname);
			if (result) {
				return {
					state: {
						...(result as State<ExtractParams<P>>),
						searchParams: url.searchParams,
					},
					handler: route.handler,
				};
			}
		}
		return null;
	}
}
