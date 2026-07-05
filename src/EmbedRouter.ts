import path from "node:path";
import { createHash } from "node:crypto";
import { match, Path } from "path-to-regexp";
import type {
	CompiledRoute,
	ResolvedRoute,
	RouteHandler,
	State,
} from "./types/routes";
import type { ExtractParams } from "./types/ExtractParams";
import {
	ButtonInteraction,
	Interaction,
	InteractionReplyOptions,
} from "discord.js";
import { BASE_URL, ID_PREFIX, PUA_RANGE, PUA_START } from "./consts";
import { pathToString } from "./helpers/pathToString";

export class EmbedRouter<L> {
	// identifier -> embedRouter
	private static usedIdentifiers = new Map<string, EmbedRouter<unknown>>();

	// Name used to generate prefixes
	private name = "";
	// Prefix for customIds of RouteButtonBuilders
	private idPrefix: string;
	private identifier: string = "";
	getIdPrefix() {
		return `${this.idPrefix}${this.identifier}`;
	}

	// All added routes
	private routes: CompiledRoute<L>[] = [];

	/**
	 *
	 * @param idPrefix the prefix for RouteButtonBuilder customIds
	 */
	constructor({
		name = "",
		idPrefix = ID_PREFIX,
	}: {
		name?: string;
		idPrefix?: string;
	} = {}) {
		if (EmbedRouter.usedIdentifiers.size >= PUA_RANGE) {
			throw new Error(`You can not have more than ${PUA_RANGE} routers`);
		}
		if (idPrefix.includes("/")) {
			throw new Error(`Prefix can't contain "/": ${idPrefix}`);
		}
		this.idPrefix = idPrefix;
		this.name = name;
		this.updateIdentifier();
	}

	private updateIdentifier() {
		// Private Use Area: Unicode Characters not from any language
		const hash = createHash("sha256").update(this.name).digest();
		let raw = hash.readUint32BE(0);
		let char: string;
		const nameCollisions = [];
		// find next available identifier
		while (true) {
			const codepoint = PUA_START + (raw++ % PUA_RANGE);
			char = String.fromCodePoint(codepoint);

			const collisionRouter = EmbedRouter.usedIdentifiers.get(char);
			if (collisionRouter === undefined) break; // no collisions

			if (this.name.length > 0 && collisionRouter.name.length === 0) {
				// evict old name; usedIdentifier is still taken
				collisionRouter.updateIdentifier();
				break;
			}

			nameCollisions.push(collisionRouter);
		}
		EmbedRouter.usedIdentifiers.set(char, this as EmbedRouter<unknown>);

		if (nameCollisions.length > 0 && this.name.length > 0) {
			process.emitWarning(
				`EmbedRouter identifier collision for name "${this.name}" with ${nameCollisions.map((c) => `"${c.name}"`).join(", ")}`,
				"EmbedRouterWarning",
			);
		}
		this.identifier = char;
	}

	/**
	 * Registers a path with the router
	 *
	 * @param routePath path to match with
	 * @param handler function that generates the message when a path is matched
	 */
	on<P extends Path = Path>(
		routePath: P | P[],
		handler: RouteHandler<L, ExtractParams<P>>,
	) {
		this.routes.push({
			path: Array.isArray(routePath) ? routePath : [routePath],
			matchFunction: match(routePath),
			handler: handler as RouteHandler<L>,
		});
	}

	/**
	 * Adds a subrouter to the router
	 *
	 * @param routePath path of the router
	 * @param embedRouter router to add at the path
	 */
	use<P extends Path = Path>(routePath: P, embedRouter: EmbedRouter<L>) {
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
	async listener(interaction: ButtonInteraction, locals?: L) {
		if (!interaction.isButton()) return;

		const customId = interaction.customId;
		if (!customId.startsWith(this.getIdPrefix())) return;

		const path = customId.slice(this.getIdPrefix().length);
		this.dispatch(interaction, path, locals);
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
		locals?: L,
		flags?: InteractionReplyOptions["flags"],
	) {
		if (interaction.isAutocomplete())
			throw new Error("Autocomplete Interactions aren't supported");

		// don't check validity because url params are considered invalid
		const resolvedRoute = this.resolve(pathToString(path, false));
		if (!resolvedRoute)
			throw new Error(`No route found for ${pathToString(path, false)}`);

		const routeResponse = resolvedRoute.handler(interaction, {
			...resolvedRoute.state,
			locals,
		});

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
	): ResolvedRoute<L, ExtractParams<P>> | null {
		const url = new URL(routePath, BASE_URL);
		for (const route of this.routes) {
			const result = route.matchFunction(url.pathname);
			if (result) {
				return {
					state: {
						...(result as State<L, ExtractParams<P>>),
						query: url.searchParams,
						embedRouter: this,
					},
					handler: route.handler,
				};
			}
		}
		return null;
	}
}
