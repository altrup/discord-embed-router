import path from "node:path";
import EventEmitter from "node:events";
import { createHash } from "node:crypto";
import { match, MatchResult, Path } from "path-to-regexp";
import type {
	ApplyHandler,
	CompiledRoute,
	Method,
	RouteHandler,
	RouteResponse,
	ExtractParams,
	Args,
	EventNames,
	Listener,
	RouteOptionsWithMethod,
} from "./types";
import {
	AnySelectMenuInteraction,
	ButtonInteraction,
	Interaction,
	InteractionReplyOptions,
	MessageFlags,
	Snowflake,
} from "discord.js";
import { ID_PREFIX, PUA_RANGE, PUA_START } from "../consts";
import { pathToString } from "../helpers/pathToString";
import { Encoder } from "../encoding/Encoder";
import { Location } from "../helpers/Location";

type EmbedRouterEvents = {
	routeError: [err: Error, interaction?: Interaction | undefined];
};

export class EmbedRouter<
	L extends object,
> extends EventEmitter<EmbedRouterEvents> {
	// identifier -> embedRouter
	static #usedIdentifiers = new Map<string, EmbedRouter<object>>();

	// Name used to generate prefixes
	#name = "";
	// Prefix for customIds of RouteButtonBuilders
	#idPrefix: string;
	#identifier: string = "";
	get idPrefix() {
		return `${this.#idPrefix}${this.#identifier}`;
	}

	// All added routes
	#routes: Map<Method, CompiledRoute<Method, L>[]> = new Map();
	// message.id -> cleanup object
	#cleanups: Map<
		Snowflake,
		{
			timeout?: NodeJS.Timeout | undefined;
			cleanupFn: NonNullable<RouteResponse["cleanup"]>;
			applyFn: ApplyHandler;
		}
	> = new Map();

	#encoder: Encoder = new Encoder();

	/**
	 *
	 * @param name the name to give the router. ensures buttons stay connected across restarts
	 * @param idPrefix the prefix for customIds
	 */
	constructor({
		name = "",
		idPrefix = ID_PREFIX,
	}: {
		name?: string | undefined;
		idPrefix?: string | undefined;
	} = {}) {
		super();

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
		EmbedRouter.#usedIdentifiers.set(char, this as EmbedRouter<object>);

		if (nameCollisions.length > 0 && this.#name.length > 0) {
			process.emitWarning(
				`EmbedRouter identifier collision for name "${this.#name}" with ${nameCollisions.map((c) => `"${c.#name}"`).join(", ")}`,
				"DiscordEmbedRouterWarning",
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

		// register segments with encoder
		if (Array.isArray(routePath)) {
			routePath.forEach((p) => this.#encoder.registerPath(p));
		} else {
			this.#encoder.registerPath(routePath);
		}
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
		try {
			if (!interaction.customId.startsWith(this.#idPrefix)) return; // don't throw any errors

			if (interaction.isAutocomplete())
				throw new Error("Autocomplete Interactions aren't supported");

			await this.#runCleanup(interaction.message.id, false);

			const res = this.#encoder.decodeInteraction(interaction, this.idPrefix);
			if (!res)
				throw new Error(`Invalid component found: id ${interaction.customId}`);

			await this.dispatch(interaction, res.path, {
				method: res.method,
				locals,
			});
		} catch (e: unknown) {
			this.emit(
				"routeError",
				e instanceof Error ? e : new Error(String(e)),
				interaction,
			);
		}
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

		const routeResponse = await this.#resolve(path, {
			interaction,
			method,
			locals,
		});
		if (routeResponse === false)
			throw new Error(`No route found for ${pathToString(path, false)}`);

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
			await interaction.update(routeResponse);
		} else {
			await interaction.reply({
				...(routeResponse as InteractionReplyOptions),
				flags,
			});
		}

		// Apply cleanup if needed
		if (!routeResponse?.cleanup) return;

		const message = await interaction.fetchReply();
		const channel = interaction.channel;
		const applyFn: ApplyHandler | undefined = message.flags.has(
			MessageFlags.Ephemeral,
		)
			? interaction.editReply.bind(interaction)
			: channel
				? (options) => channel.messages.edit(message.id, options)
				: undefined;
		if (!applyFn)
			return process.emitWarning(
				`Could not derive applyFunction for ${pathToString(path, false)}. Cleanup return results will not be applied to message.`,
				"DiscordEmbedRouterWarning",
			);

		this.#addCleanup(
			message.id,
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
		// don't check validity because query params are considered invalid
		const pathString = pathToString(path, false);
		const location = new Location(pathString);
		for (const route of this.#routes.get(method) ?? []) {
			const result = route.matchFunction(location.pathname);
			if (result) {
				return await route.handler(interaction, {
					...(result as MatchResult<ExtractParams<P>>),
					query: location.queryParams,
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
			timeout: isFinite(timeout)
				? setTimeout(() => this.#runCleanup(messageId, true), timeout)
				: undefined,
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

		try {
			this.#removeCleanup(messageId);
			const result = await cleanup?.cleanupFn();
			if (applyResult && result) {
				await cleanup.applyFn(result).catch(console.error);
			}
		} catch (e: unknown) {
			this.emit(
				"routeError",
				e instanceof Error ? e : new Error(String(e)),
				undefined,
			);
		}
	}

	/**
	 *
	 * @param path raw unencoded path
	 * @param method the html method to encode into the path
	 * @param query any query params to include in the encoded string
	 * @param idPrefix string to prefix the encoded path with (optional, defaults to this router's prefix)
	 * @returns
	 */
	public encodePath<
		AllowEmptyMethod extends boolean = false,
		P extends Path = Path,
	>(
		path: P,
		{
			method,
			query,
			idPrefix = this.idPrefix,
		}: RouteOptionsWithMethod<AllowEmptyMethod> & {
			idPrefix?: string | undefined;
		},
	) {
		return this.#encoder.encodePath(path, {
			idPrefix,
			method,
			query,
		});
	}

	// event helpers
	public onError(listener: Listener<EmbedRouterEvents, "routeError">) {
		return this.on("routeError", listener);
	}

	override emit<E extends string | symbol>(
		eventName: EventNames<EmbedRouterEvents, E>,
		...args: Args<EmbedRouterEvents, E>
	): boolean {
		if (eventName === "routeError" && this.listenerCount(eventName) === 0) {
			console.error(args);
		}
		return super.emit(eventName, ...args);
	}
}
