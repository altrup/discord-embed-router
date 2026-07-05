import path from "node:path";
import { createHash } from "node:crypto";
import { match, MatchResult, Path } from "path-to-regexp";
import type {
	ApplyHandler,
	CompiledRoute,
	Method,
	RouteHandler,
	RouteResponse,
} from "./types/routes";
import type { ExtractParams } from "./types/ExtractParams";
import {
	AnySelectMenuInteraction,
	BitFieldResolvable,
	ButtonInteraction,
	Interaction,
	InteractionEditReplyOptions,
	InteractionReplyOptions,
	InteractionResponse,
	MessageFlags,
	MessageFlagsBitField,
	Snowflake,
} from "discord.js";
import { BASE_URL, ID_PREFIX, PUA_RANGE, PUA_START } from "./consts";
import { pathToString } from "./helpers/pathToString";
import { decodePath } from "./helpers/decodePath";

export class EmbedRouter<L> {
	// identifier -> embedRouter
	static #usedIdentifiers = new Map<string, EmbedRouter<unknown>>();

	// Name used to generate prefixes
	#name = "";
	// Prefix for customIds of RouteButtonBuilders
	#idPrefix: string;
	#identifier: string = "";
	public getIdPrefix() {
		return `${this.#idPrefix}${this.#identifier}`;
	}

	// All added routes
	#routes: Map<Method, CompiledRoute<Method, L>[]> = new Map();
	// message.id -> cleanup object
	#cleanups: Map<
		Snowflake,
		{
			timeout: NodeJS.Timeout;
			cleanupFn: NonNullable<RouteResponse["cleanup"]>;
			applyFn: ApplyHandler;
		}
	> = new Map();

	/**
	 *
	 * @param name the name to give the router. ensures buttons stay connected across restarts
	 * @param idPrefix the prefix for RouteButtonBuilder customIds
	 */
	constructor({
		name = "",
		idPrefix = ID_PREFIX,
	}: {
		name?: string | undefined;
		idPrefix?: string | undefined;
	} = {}) {
		if (EmbedRouter.#usedIdentifiers.size >= PUA_RANGE) {
			throw new Error(`You can not have more than ${PUA_RANGE} routers`);
		}
		if (idPrefix.includes("/")) {
			throw new Error(`Prefix can't contain "/": ${idPrefix}`);
		}
		this.#idPrefix = idPrefix;
		this.#name = name;
		this.#updateIdentifier();
	}

	#updateIdentifier() {
		// Private Use Area: Unicode Characters not from any language
		const hash = createHash("sha256").update(this.#name).digest();
		let raw = hash.readUint32BE(0);
		let char: string;
		const nameCollisions = [];
		// find next available identifier
		while (true) {
			const codepoint = PUA_START + (raw++ % PUA_RANGE);
			char = String.fromCodePoint(codepoint);

			const collisionRouter = EmbedRouter.#usedIdentifiers.get(char);
			if (collisionRouter === undefined) break; // no collisions

			if (this.#name.length > 0 && collisionRouter.#name.length === 0) {
				// evict old name; usedIdentifier is still taken
				collisionRouter.#updateIdentifier();
				break;
			}

			nameCollisions.push(collisionRouter);
		}
		EmbedRouter.#usedIdentifiers.set(char, this as EmbedRouter<unknown>);

		if (nameCollisions.length > 0 && this.#name.length > 0) {
			process.emitWarning(
				`EmbedRouter identifier collision for name "${this.#name}" with ${nameCollisions.map((c) => `"${c.#name}"`).join(", ")}`,
				"EmbedRouterWarning",
			);
		}
		this.#identifier = char;
	}

	#addRoute<M extends Method, P extends Path = Path>(
		method: M,
		routePath: P | P[],
		handler: RouteHandler<M, L, ExtractParams<P>>,
	) {
		const methodRoutes = this.#routes.get(method) ?? [];
		methodRoutes.push({
			method,
			path: Array.isArray(routePath) ? routePath : [routePath],
			matchFunction: match(routePath),
			handler: handler as RouteHandler<M, L>,
		});
		this.#routes.set(method, methodRoutes);
	}

	/**
	 * Registers a path with the router
	 *
	 * @param routePath path to match with
	 * @param handler function that generates the message when a path is matched
	 */
	public get<P extends Path = Path>(
		routePath: P | P[],
		handler: RouteHandler<"GET", L, ExtractParams<P>>,
	) {
		this.#addRoute("GET", routePath, handler);
	}

	/**
	 * Registers a path with the router
	 *
	 * @param routePath path to match with
	 * @param handler function that generates the message when a path is matched
	 */
	public post<P extends Path = Path>(
		routePath: P | P[],
		handler: RouteHandler<"POST", L, ExtractParams<P>>,
	) {
		this.#addRoute("POST", routePath, handler);
	}

	/**
	 * Registers a path with the router
	 *
	 * @param routePath path to match with
	 * @param handler function that generates the message when a path is matched
	 */
	public put<P extends Path = Path>(
		routePath: P | P[],
		handler: RouteHandler<"PUT", L, ExtractParams<P>>,
	) {
		this.#addRoute("PUT", routePath, handler);
	}

	/**
	 * Registers a path with the router
	 *
	 * @param routePath path to match with
	 * @param handler function that generates the message when a path is matched
	 */
	public patch<P extends Path = Path>(
		routePath: P | P[],
		handler: RouteHandler<"PATCH", L, ExtractParams<P>>,
	) {
		this.#addRoute("PATCH", routePath, handler);
	}

	/**
	 * Registers a path with the router
	 *
	 * @param routePath path to match with
	 * @param handler function that generates the message when a path is matched
	 */
	public delete<P extends Path = Path>(
		routePath: P | P[],
		handler: RouteHandler<"DELETE", L, ExtractParams<P>>,
	) {
		this.#addRoute("DELETE", routePath, handler);
	}

	/**
	 * Adds a subrouter to the router
	 *
	 * @param routePath path of the router
	 * @param embedRouter router to add at the path
	 */
	public use<P extends Path = Path>(
		routePath: P,
		embedRouter: EmbedRouter<Partial<L>>,
	) {
		const pathString = pathToString(routePath);
		for (const [method, routes] of embedRouter.#routes) {
			for (const route of routes) {
				this.#addRoute(
					method,
					route.path.map((p) => path.posix.join(pathString, pathToString(p))),
					route.handler,
				);
			}
		}
	}

	/**
	 * Must be attached to "interactionCreate" event for RouteButtonBuilder to work
	 *
	 * @param interaction interactions from "interactionCreate" (filter for ButtonInteractions)
	 */
	public async listener(
		interaction: ButtonInteraction | AnySelectMenuInteraction,
		locals?: L | undefined,
	) {
		if (interaction.isAutocomplete())
			throw new Error("Autocomplete Interactions aren't supported");

		this.#runCleanup(interaction.message.id, false);

		const res = decodePath({ idPrefix: this.getIdPrefix(), interaction });
		if (!res)
			throw new Error(`Invalid component found: id ${interaction.customId}`);

		this.dispatch(interaction, res.path, { method: res.method, locals });
	}

	/**
	 * Replies to or editReplies to an interaction based on the route output
	 *
	 * @param interaction interaction to connect to
	 * @param path path to route the interaction to
	 * @param method method to send to route
	 * @param flags discord flags to send with message (optional, only allowed on first reply)
	 * @param locals additional info to pass in to page through state.local (optional)
	 */
	public async dispatch<P extends Path = Path>(
		interaction: Interaction,
		path: P,
		{
			method = "GET",
			flags,
			locals,
		}: {
			method?: Method;
			flags?: InteractionReplyOptions["flags"] | undefined;
			locals?: L | undefined;
		} = {},
	) {
		if (interaction.isAutocomplete())
			throw new Error("Autocomplete Interactions aren't supported");

		// don't check validity because url params are considered invalid
		const routeResponse = await this.#resolve(path, {
			interaction,
			method,
			locals,
		});
		if (routeResponse === false)
			throw new Error(`No route found for ${pathToString(path, false)}`);

		let response: InteractionResponse | undefined = undefined;
		if (interaction.replied || interaction.deferred) {
			if (flags)
				throw new Error(
					"You can only set flags for interactions that haven't been replied to",
				);
			if (routeResponse) await interaction.editReply(routeResponse);
		} else if (!routeResponse) {
			if ("deferUpdate" in interaction) {
				await interaction.deferUpdate();
			} else {
				await interaction.deferReply();
			}
		} else if ("update" in interaction) {
			if (flags)
				throw new Error(
					"You can only set flags for interactions that haven't been replied to",
				);
			response = await interaction.update(routeResponse);
		} else {
			response = await interaction.reply({
				...(routeResponse as InteractionReplyOptions),
				flags,
			});
		}

		// Apply cleanup if needed
		if (!routeResponse?.cleanup) return;

		const messageId = response
			? response.id
			: "message" in interaction
				? interaction.message?.id
				: undefined;
		if (messageId === undefined) return;

		const channel = interaction.channel;
		const applyFn = new MessageFlagsBitField(
			flags as BitFieldResolvable<keyof typeof MessageFlags, number>,
		).has(MessageFlags.Ephemeral)
			? interaction.editReply.bind(interaction)
			: channel
				? (options: string | InteractionEditReplyOptions) =>
						channel.messages.edit(messageId, options)
				: undefined;
		if (!applyFn)
			return process.emitWarning(
				`Could not derive applyFunction for ${pathToString(path, false)}. Cleanup return reuslts will not be applied to message.`,
				"EmbedRouterWarning",
			);

		this.#addCleanup(
			messageId,
			routeResponse.cleanup.bind(routeResponse),
			applyFn,
			routeResponse?.timeout,
		);
	}

	/**
	 * Resolves a route to the associated message (DOES NOT UPDATE MESSAGE)
	 *
	 * @param interaction interaction to connect to
	 * @param path path to route the interaction to
	 * @param method method to send to route
	 * @param locals additional info to pass in to page through state.local (optional)
	 * @returns discord message associated with route OR false
	 */
	async #resolve<P extends Path>(
		path: P,
		{
			interaction,
			method = "GET",
			locals,
		}: {
			interaction: Interaction;
			method?: Method;
			locals?: L | undefined;
		},
	): Promise<RouteResponse | undefined | false> {
		// don't check validity because url params are considered invalid
		const url = new URL(pathToString(path, false), BASE_URL);
		for (const route of this.#routes.get(method) ?? []) {
			const result = route.matchFunction(url.pathname);
			if (result) {
				return await route.handler(interaction, {
					...(result as MatchResult<ExtractParams<P>>),
					query: url.searchParams,
					embedRouter: this,
					locals,
				});
			}
		}
		return false;
	}

	// Helpers for using and storing cleanup functions
	#addCleanup(
		messageId: Snowflake,
		cleanupFn: NonNullable<RouteResponse["cleanup"]>,
		applyFn: ApplyHandler,
		timeout: number,
	) {
		this.#removeCleanup(messageId);
		this.#cleanups.set(messageId, {
			cleanupFn,
			applyFn,
			timeout: setTimeout(() => this.#runCleanup(messageId, true), timeout),
		});
	}

	#removeCleanup(messageId: Snowflake) {
		const cleanup = this.#cleanups.get(messageId);
		if (!cleanup) return;

		clearTimeout(cleanup.timeout);
		this.#cleanups.delete(messageId);
	}

	async #runCleanup(messageId: Snowflake, applyResult: boolean) {
		const cleanup = this.#cleanups.get(messageId);
		if (!cleanup) return;

		this.#removeCleanup(messageId);
		const result = await cleanup?.cleanupFn();
		if (applyResult && result) {
			await cleanup.applyFn(result).catch(console.error);
		}
	}
}
