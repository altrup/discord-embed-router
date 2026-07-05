import path from "node:path";
import {
	match,
	ParamData,
	parse,
	Path,
	stringify,
	TokenData,
} from "path-to-regexp";
import {
	CompiledRoute,
	ResolvedRoute,
	RouteHandler,
	State,
} from "./types/routes";
import { ExtractParams } from "./types/ExtractParams";
import {
	AutocompleteInteraction,
	Interaction,
	InteractionReplyOptions,
} from "discord.js";

export default class EmbedRouter {
	// single path -> RouteHandler
	private routes: CompiledRoute<ParamData>[] = [];

	constructor() {}

	// main command for registering paths
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

	// command for adding a subrouter
	use<P extends Path = Path>(routePath: P, router: EmbedRouter) {
		const pathString = this.pathToString(routePath);
		for (const route of router.routes) {
			this.on(
				route.path.map((p) =>
					path.posix.join(pathString, this.pathToString(p)),
				),
				route.handler,
			);
		}
	}

	// command for using router
	async handleInteraction<P extends Path = Path>(
		interaction: Interaction,
		initialPath: P,
		flags?: InteractionReplyOptions["flags"],
	) {
		if (interaction.isAutocomplete()) {
			throw new Error("Autocomplete Interactions aren't supported");
		}

		return await this.updateInteraction(interaction, initialPath, flags);
	}

	private async updateInteraction<P extends Path = Path>(
		interaction: Exclude<Interaction, AutocompleteInteraction>,
		initialPath: P,
		flags?: InteractionReplyOptions["flags"],
	) {
		const resolvedRoute = this.resolve(initialPath);
		if (!resolvedRoute) {
			throw new Error(`No route found for ${this.pathToString(initialPath)}`);
		}

		const routeResponse = resolvedRoute.handler(
			interaction,
			resolvedRoute.state,
		);

		if (interaction.replied || interaction.deferred) {
			if (flags) {
				throw new Error(
					"You can only set flags for interactions that haven't been replied to",
				);
			}
			await interaction.editReply(routeResponse);
		} else if ("update" in interaction) {
			if (flags) {
				throw new Error(
					"You can only set flags for interactions that haven't been replied to",
				);
			}
			await interaction.update(routeResponse);
		} else {
			interaction.reply({
				...(routeResponse as InteractionReplyOptions),
				flags,
			});
		}
	}

	private resolve<P extends Path = Path>(
		routePath: P,
	): ResolvedRoute<ExtractParams<P>> | null {
		const pathString = this.pathToString(routePath);
		for (const route of this.routes) {
			const result = route.matchFunction(pathString);
			if (result) {
				return {
					state: result as State<ExtractParams<P>>,
					handler: route.handler,
				};
			}
		}
		return null;
	}

	private pathToString<P extends Path>(path: P): string {
		return stringify(path instanceof TokenData ? path : parse(path));
	}
}
