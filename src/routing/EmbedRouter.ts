import path from "node:path";
import EventEmitter from "node:events";
import { createHash } from "node:crypto";
import { compile, match, MatchResult, Path } from "path-to-regexp";
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
	CleanupReason,
	SessionProvider,
	LocalsProvider,
	CleanupHandler,
} from "./types";
import {
	AnySelectMenuInteraction,
	ButtonInteraction,
	Client,
	Interaction,
	InteractionReplyOptions,
	MessageFlags,
	Snowflake,
} from "discord.js";
import { ID_PREFIX, PUA_RANGE, PUA_START } from "@src/consts";
import { pathToString } from "@helpers/pathToString";
import { Encoder } from "@encoding/Encoder";
import { Location } from "@helpers/Location";

type EmbedRouterEvents = {
	routeError: [err: Error, interaction?: Interaction | undefined];
};

export class EmbedRouter<
	Globals = unknown,
	Session = unknown,
	Locals = unknown,
> extends EventEmitter<EmbedRouterEvents> {
	// identifier -> embedRouter
	static #usedIdentifiers = new Map<
		string,
		EmbedRouter<object, object, object>
	>();

	// Not used after constructor, but stored to check if this router is capable of using RouteComponentBuilders
	#client: Client | undefined;

	// Name used to generate prefixes
	#name = "";
	// Prefix for customIds of RouteButtonBuilders
	#idPrefix: string;
	#identifier: string = "";
	get idPrefix() {
		return `${this.#idPrefix}${this.#identifier}`;
	}

	// All added routes
	#routes: Map<Method, CompiledRoute<Method, Globals, Session, Locals>[]> =
		new Map();
	// message.id -> cleanup object
	#cleanups: Map<
		Snowflake,
		{
			timeout: NodeJS.Timeout;
			cleanupFn: CleanupHandler | undefined;
			applyFn: ApplyHandler | undefined;
		}
	> = new Map();

	// Encoder for paths
	#encoder: Encoder = new Encoder();

	// Persistant storage
	#globals: Globals | undefined;
	#sessions: Map<Snowflake, Session> = new Map();
	#sessionProvider: undefined | SessionProvider<Globals, Session, Locals>;
	#localsProvider: undefined | LocalsProvider<Globals, Session, Locals>;

	/**
	 * registers a session provider with this router
	 *
	 * @param sessionProvider the session provider to set
	 */
	public setSessionProvider(
		sessionProvider: SessionProvider<Globals, Session, Locals>,
	) {
		this.#sessionProvider = sessionProvider;
	}
	/**
	 * deletes the session provider on this router
	 */
	public deleteSessionProvider() {
		this.#sessionProvider = undefined;
	}

	/**
	 * registers a locals provider with this router
	 *
	 * @param localsProvider the locals provider to set
	 */
	public setLocalsProvider(
		localsProvider: LocalsProvider<Globals, Session, Locals>,
	) {
		this.#localsProvider = localsProvider;
	}
	/**
	 * deletes the locals provider on this router
	 */
	public deleteLocalsProvider() {
		this.#localsProvider = undefined;
	}

	/**
	 *
	 * @param client the client from discord.js to connect to
	 * @param name the name to give the router. ensures buttons stay connected across restarts
	 * @param idPrefix the prefix for customIds
	 */
	constructor(
		client?: Client | undefined,
		{
			name = "",
			idPrefix = ID_PREFIX,
			globals,
		}: {
			name?: string | undefined;
			idPrefix?: string | undefined;
			globals?: Globals | undefined;
		} = {},
	) {
		super();

		if (EmbedRouter.#usedIdentifiers.size >= PUA_RANGE) {
			throw new Error(`You can not have more than ${PUA_RANGE} routers`);
		}
		if (idPrefix.includes("/")) {
			throw new Error(`Prefix can't contain "/": ${idPrefix}`);
		}

		this.#name = name;
		this.#idPrefix = idPrefix;
		this.#globals = globals;
		this.#updateIdentifier();

		this.#client = client;
		client?.on("interactionCreate", (interaction) =>
			this.#listener(interaction),
		);
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
		EmbedRouter.#usedIdentifiers.set(
			char,
			this as unknown as EmbedRouter<object, object, object>,
		);

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
		handler: RouteHandler<M, Globals, Session, Locals, ExtractParams<P>>,
	) {
		const methodRoutes = this.#routes.get(method) ?? [];
		methodRoutes.push({
			method,
			path: Array.isArray(routePath) ? routePath : [routePath],
			matchFunction: match(routePath),
			handler: handler as RouteHandler<M, Globals, Session, Locals>,
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
		handler: RouteHandler<"GET", Globals, Session, Locals, ExtractParams<P>>,
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
		handler: RouteHandler<"POST", Globals, Session, Locals, ExtractParams<P>>,
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
		handler: RouteHandler<"PUT", Globals, Session, Locals, ExtractParams<P>>,
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
		handler: RouteHandler<"PATCH", Globals, Session, Locals, ExtractParams<P>>,
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
		handler: RouteHandler<"DELETE", Globals, Session, Locals, ExtractParams<P>>,
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
		embedRouter: EmbedRouter<
			Partial<Globals>,
			Partial<Session>,
			Partial<Locals>
		>,
	) {
		const pathString = pathToString(routePath);
		for (const [method, routes] of embedRouter.#routes) {
			for (const route of routes) {
				this.#addRoute(
					method,
					route.path.map((p) => path.posix.join(pathString, pathToString(p))),
					route.handler as unknown as RouteHandler<
						Method,
						Globals,
						Session,
						Locals
					>,
				);
			}
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
			locals = this.#localsProvider?.(this, interaction),
		}: {
			method?: Method;
			flags?: InteractionReplyOptions["flags"] | undefined;
			locals?: Locals | undefined;
		} = {},
	) {
		if (!this.isSupportedInteraction(interaction))
			throw new Error(
				`Interactions type is not supported: ${interaction.type}`,
			);

		const session =
			("message" in interaction
				? this.#sessions.get(interaction.message.id)
				: undefined) ?? this.#sessionProvider?.(this, interaction);
		const routeResponse = await this.#resolve(path, {
			interaction,
			method,
			session,
			locals,
		});
		if (routeResponse === undefined) return;
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

		// Apply session and cleanup if needed
		if (!session && !routeResponse.cleanup) return;

		const message = await interaction.fetchReply();
		if (session) this.#sessions.set(message.id, session);

		const channel = interaction.channel;
		const applyFn: ApplyHandler | undefined = message.flags.has(
			MessageFlags.Ephemeral,
		)
			? interaction.editReply.bind(interaction)
			: channel
				? (options) => channel.messages.edit(message.id, options)
				: undefined;
		if (!applyFn)
			process.emitWarning(
				`Could not derive applyFunction for ${pathToString(path, false)}. Cleanup return results will not be applied to message.`,
				"DiscordEmbedRouterWarning",
			);

		this.#addCleanup(
			message.id,
			routeResponse.cleanup?.bind(routeResponse),
			applyFn,
			routeResponse.timeout,
		);
	}

	/**
	 * Attached to "interactionCreate" event to detect our custom RouteComponents
	 *
	 * @param interaction interactions from "interactionCreate" (filter for ButtonInteractions)
	 */
	async #listener(interaction: Interaction) {
		try {
			if (
				!this.isSupportedInteraction(interaction) ||
				interaction.isChatInputCommand()
			)
				return;
			if (!interaction.customId.startsWith(this.#idPrefix)) return; // don't throw any errors

			await this.#runCleanup(interaction.message.id, "interaction");

			const res = this.#decodeInteraction(interaction, this.idPrefix);
			if (!res)
				throw new Error(`Invalid component found: id ${interaction.customId}`);

			await this.dispatch(interaction, res.path, {
				method: res.method,
				locals: this.#localsProvider?.(this, interaction),
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
	 * Returns if an interaction is a supported type
	 *
	 * @param interaction the interaction to check
	 * @returns if interaction is a supported type
	 */
	public isSupportedInteraction(interaction: Interaction) {
		return (
			interaction.isAnySelectMenu() ||
			interaction.isButton() ||
			interaction.isChatInputCommand()
		);
	}

	/**
	 * Decodes an interaction that came from a componentBuilder in this package
	 *
	 * @param interaction the interaction from Discord.js to decode
	 * @param idPrefix string that the encoded path was prefixed with
	 * @returns the method and path that was encoded from the interaction
	 */
	#decodeInteraction(
		interaction: ButtonInteraction | AnySelectMenuInteraction,
		idPrefix: string,
	): { method: Method; path: string } | false {
		const customId = interaction.customId;
		if (!customId.startsWith(idPrefix)) return false;

		const decodedPath = this.#encoder.decodePath(interaction.customId, {
			idPrefix,
		});
		if (decodedPath === false) return false;

		if (interaction.isButton()) {
			return {
				method: decodedPath.method,
				path: this.#fillParams(decodedPath.path, {
					ts: interaction.createdTimestamp.toString(),
				}).toString(),
			};
		} else if (interaction.isAnySelectMenu()) {
			if (interaction.values.length === 0) return false;

			if (interaction.isStringSelectMenu()) {
				// also fill in variables for to's
				const toLocations = interaction.values
					.map((v) =>
						this.#encoder.decodePath(v, {
							idPrefix: "",
							allowEmptyMethod: true,
						}),
					)
					.filter((r) => r !== false)
					.map((r) =>
						this.#fillParams(r.path, {
							ts: interaction.createdTimestamp.toString(),
						}),
					);
				const pathLocation = this.#fillParams(
					decodedPath.path,
					{
						ts: interaction.createdTimestamp.toString(),
						to: toLocations[0]?.pathname.split("/").filter((s) => s.length > 0),
						tos: toLocations
							.map((l) => l.pathname.split("/"))
							.flat()
							.filter((s) => s.length > 0),
					},
					{
						ts: interaction.createdTimestamp.toString(),
						to: toLocations[0]?.pathname,
						tos: toLocations.map((l) => l.pathname),
					},
				);

				// merge query params
				for (const toLocation of toLocations) {
					for (const [key, value] of toLocation?.queryParams ?? []) {
						pathLocation.queryParams.append(key, value);
					}
				}
				return {
					method: decodedPath.method,
					path: pathLocation.toString(),
				};
			}

			return {
				method: decodedPath.method,
				path: this.#fillParams(decodedPath.path, {
					ts: interaction.createdTimestamp.toString(),
					[interaction.isChannelSelectMenu()
						? "channelId"
						: interaction.isRoleSelectMenu()
							? "roleId"
							: "userId"]: interaction.values[0],
					[interaction.isChannelSelectMenu()
						? "channelIds"
						: interaction.isRoleSelectMenu()
							? "roleIds"
							: "userIds"]: interaction.values,
				}).toString(),
			};
		}

		return false;
	}

	#fillParams(
		path: string,
		params: Partial<Record<string, string | string[]>> = {},
		queryParams = params,
	): Location {
		const location = new Location(path);
		const toPath = compile(location.pathname);

		location.pathname = toPath(params);
		for (const [key, value] of location.queryParams) {
			if (
				(value.startsWith(":") || value.startsWith("*")) &&
				value.slice(1) in queryParams
			) {
				const paramValue = queryParams?.[value.slice(1)];
				if (paramValue) {
					location.queryParams.delete(key, value);
					if (Array.isArray(paramValue))
						paramValue.forEach((pv) => location.queryParams.append(key, pv));
					else location.queryParams.append(key, paramValue);
				} else {
					location.queryParams.delete(key);
				}
			}
		}
		return location;
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
	async #resolve<P extends Path = Path>(
		path: P,
		{
			interaction,
			method = "GET",
			session,
			locals,
		}: {
			interaction: Interaction;
			method?: Method;
			session: Session | undefined;
			locals: Locals | undefined;
		},
	): Promise<RouteResponse<Session> | undefined | false> {
		// don't check validity because query params are considered invalid
		const pathString = pathToString(path, false);
		const location = new Location(pathString);
		for (const route of this.#routes.get(method) ?? []) {
			const result = route.matchFunction(location.pathname);
			if (result) {
				return await route.handler(this, interaction, {
					...(result as MatchResult<ExtractParams<P>>),
					queryParams: location.queryParams,
					globals: this.#globals,
					session,
					locals,
				});
			}
		}
		return false;
	}

	// Helpers for using and storing cleanup functions
	#addCleanup(
		messageId: Snowflake,
		cleanupFn: CleanupHandler | undefined,
		applyFn: ApplyHandler | undefined,
		timeout: number | undefined,
	) {
		if (!timeout || !isFinite(timeout))
			throw new Error(
				"Timeout is required for components using cleanups or sessions",
			);

		this.#removeCleanup(messageId);
		this.#cleanups.set(messageId, {
			cleanupFn,
			applyFn,
			timeout: setTimeout(
				() => this.#runCleanup(messageId, "timeout"),
				timeout,
			),
		});
	}

	#removeCleanup(messageId: Snowflake) {
		const cleanup = this.#cleanups.get(messageId);
		if (!cleanup) return;

		clearTimeout(cleanup.timeout);
		this.#cleanups.delete(messageId);
	}

	async #runCleanup(messageId: Snowflake, reason: CleanupReason) {
		const cleanup = this.#cleanups.get(messageId);
		if (!cleanup) return;

		try {
			this.#removeCleanup(messageId);
			if (reason === "timeout") {
				this.#sessions.delete(messageId);
			}
			const result = await cleanup?.cleanupFn?.(reason);
			if (result && reason === "timeout") {
				await cleanup.applyFn?.(result).catch(console.error);
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
		if (!this.#client)
			throw new Error(
				`Cannot build a component customId for router "${this.#name || this.idPrefix}"; no client was passed to its constructor, so no interaction events are caught by the router`,
			);

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
