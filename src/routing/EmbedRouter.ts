import EventEmitter from "node:events";
import path from "node:path";

import {
	Client,
	Interaction,
	InteractionReplyOptions,
	Message,
	MessageFlags,
} from "discord.js";
import { match, MatchResult, Path } from "path-to-regexp";

import { COMPONENT_PARAMS } from "@componentBuilders/componentParams";
import { Encoder } from "@encoding/Encoder";
import { HashEncoder } from "@encoding/HashEncoder";
import { Location } from "@helpers/Location";
import { pathToString } from "@helpers/pathToString";
import { puaCodepointsFrom } from "@helpers/puaCodepoints";
import { toError } from "@helpers/toError";
import { InteractionDecoder } from "@routing/InteractionDecoder";
import { MessageQueue } from "@routing/MessageQueue";
import type {
	Args,
	CompiledRoute,
	EventNames,
	ExtractParams,
	Listener,
	LocalsProvider,
	Method,
	ModalRender,
	ModalResult,
	RouteHandler,
	RouteOptions,
	RouteOptionsWithMethod,
	RouteRender,
	RouteResult,
	Unused,
} from "@routing/types";
import { CleanupManager } from "@sessions/CleanupManager";
import { SessionManager } from "@sessions/SessionManager";
import type { ApplyHandler, SessionHandle } from "@sessions/types";
import { ConfigError } from "@src/ConfigError";
import { ID_PREFIX, PUA_RANGE } from "@src/consts";

type EmbedRouterEvents = {
	routeError: [err: Error, interaction?: Interaction | undefined];
};

// guards against a route handler that redirects into a cycle
const MAX_REDIRECTS = 10;

export class EmbedRouter<
	Globals = Unused,
	Session = Unused,
	Locals = Unused,
> extends EventEmitter<EmbedRouterEvents> {
	// identifier -> embedRouter
	static #usedIdentifiers = new Map<string, EmbedRouter>();

	// Not used after constructor, but stored to check if this router is capable of using RouteComponentBuilders
	#client: Client | undefined;
	#attachedListener = this.#listener.bind(this);

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

	// Encoder for paths; assigned in the constructor (see #encoder's assignment
	// there) since #interactionDecoder must be built from the resolved encoder,
	// not a default that a passed-in `encoder` option would then replace
	#encoder: Encoder;
	#interactionDecoder: InteractionDecoder;

	// Persistant storage
	#globals: Globals | undefined;

	// Session storage and cleanup/timeout lifecycle for messages
	#sessionManager: SessionManager<Session> = new SessionManager();
	#cleanupManager: CleanupManager<Globals, Session, Locals> =
		new CleanupManager(this.#sessionManager, (err, interaction) =>
			this.emit("routeError", err, interaction),
		);
	// serializes dispatch per message, so concurrent interactions on the same
	// message can't interleave their session reads/writes
	#messageQueue: MessageQueue = new MessageQueue();

	#localsProvider: undefined | LocalsProvider<Globals, Session, Locals>;

	/**
	 * Sets the client which we listen for interaections on
	 *
	 * @param client the client to listen to
	 */
	public setClient(client: Client) {
		this.#client?.off("interactionCreate", this.#attachedListener);
		this.#client = client;
		client?.on("interactionCreate", this.#attachedListener);
	}

	/**
	 * Set the globals for a router
	 *
	 * @param globals new globals
	 */
	public setGlobals(globals: Globals) {
		this.#globals = globals;
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
	 * @param globals object to pass into all routes
	 */
	constructor(
		client?: Client | undefined,
		{
			name = "",
			idPrefix = ID_PREFIX,
			globals,
			encoder = new HashEncoder(),
		}: {
			name?: string | undefined;
			idPrefix?: string | undefined;
			globals?: Globals | undefined;
			encoder?: Encoder | undefined;
		} = {},
	) {
		super();

		this.#name = name;
		this.#idPrefix = idPrefix;
		this.#globals = globals;
		this.#updateIdentifier();

		this.#encoder = encoder;
		this.#interactionDecoder = new InteractionDecoder(this.#encoder);
		// componentBuilders embed these params into their paths regardless of
		// whether a developer's own routes declare them, so register them up
		// front to guarantee they get a compact encoding
		COMPONENT_PARAMS.forEach((p) => this.#encoder.registerPath(p));

		this.#client = client;
		client?.on("interactionCreate", this.#attachedListener);
	}

	#updateIdentifier() {
		// Private Use Area: Unicode Characters not from any language
		if (EmbedRouter.#usedIdentifiers.size >= PUA_RANGE)
			throw new ConfigError(`You can not have more than ${PUA_RANGE} routers`);

		let char: string | undefined;
		const nameCollisions = [];
		// find next available identifier; the size check above guarantees the
		// generator (which cycles through the whole space before repeating)
		// finds one within PUA_RANGE candidates
		for (const candidate of puaCodepointsFrom(this.#name)) {
			const collisionRouter = EmbedRouter.#usedIdentifiers.get(candidate);
			if (collisionRouter === undefined) {
				char = candidate;
				break;
			}

			if (this.#name.length > 0 && collisionRouter.#name.length === 0) {
				// evict old name; usedIdentifier is still taken
				collisionRouter.#updateIdentifier();
				char = candidate;
				break;
			}

			nameCollisions.push(collisionRouter);
		}
		if (char === undefined)
			throw new ConfigError(
				"Internal error: no available identifier found despite passing the capacity check",
			);
		EmbedRouter.#usedIdentifiers.set(char, this as unknown as EmbedRouter);

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
	 * Registers a path with the router
	 *
	 * @param routePath path to match with
	 * @param handler function that builds the modal to show when a path is matched
	 */
	public modal<P extends Path = Path>(
		routePath: P | P[],
		handler: RouteHandler<"MODAL", Globals, Session, Locals, ExtractParams<P>>,
	) {
		this.#addRoute("MODAL", routePath, handler);
	}

	/**
	 * Adds a subrouter to the router
	 *
	 * @param routePath path of the router
	 * @param embedRouter router to add at the path
	 */
	public use<P extends Path = Path>(
		routePath: P,
		embedRouter: EmbedRouter<Globals, Session, Locals>,
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
	 * @param query query params to merge into the path, same as encodePath's query option
	 * @param flags discord flags to send with message (optional, only allowed on first reply)
	 * @param locals additional info to pass in to page through state.local (optional)
	 */
	public async dispatch<P extends Path = Path>(
		interaction: Interaction,
		path: P,
		{
			method = "GET",
			query,
			flags,
			locals = this.#localsProvider?.(this, interaction),
		}: RouteOptions & {
			flags?: InteractionReplyOptions["flags"] | undefined;
			locals?: Locals | undefined;
		} = {},
	) {
		let message: Message | undefined;
		try {
			if (!this.isSupportedInteraction(interaction))
				throw new Error(
					`Interactions type is not supported: ${interaction.type}`,
				);

			// modal submits shown from a command have no message
			message =
				"message" in interaction
					? (interaction.message ?? undefined)
					: undefined;
			const session = this.#sessionManager.open(interaction, message?.id);

			const pathWithQuery = new Location(
				pathToString(path, false),
				query,
			).toString();
			const resolved = await this.#resolve(pathWithQuery, {
				interaction,
				method,
				locals,
				session,
			});
			if (resolved === false)
				throw new ConfigError(`No route found for ${pathWithQuery}`);

			if ("modal" in resolved) {
				if (resolved.modal) {
					if (flags)
						throw new ConfigError("You can not set flags when showing a modal");
					if (
						interaction.replied ||
						interaction.deferred ||
						!("showModal" in interaction)
					)
						throw new ConfigError(
							"Modals can only be shown from interactions that haven't been replied to or deferred, and that aren't modal submissions themselves",
						);
					await interaction.showModal(resolved.modal);
				} else if (!interaction.replied && !interaction.deferred) {
					// silent ack; same mechanics as an undefined render below
					if ("deferUpdate" in interaction && message) {
						await interaction.deferUpdate();
					} else {
						await interaction.deferReply();
					}
				}
				// showing a modal never edits the message: the message's existing
				// cleanup/timeout (and committed session) stay untouched, and the
				// read-only working copy is dropped
				this.#sessionManager.discard(interaction);
				return;
			}

			const routeResponse = resolved.message;
			if (interaction.replied || interaction.deferred) {
				if (flags)
					throw new ConfigError(
						"You can only set flags for interactions that haven't been replied to",
					);
				if (routeResponse) await interaction.editReply(routeResponse);
			} else if (routeResponse === undefined) {
				// update-style acks need a message to update; a modal submit
				// shown from a command has none, so fall back to reply-style
				if ("deferUpdate" in interaction && message) {
					await interaction.deferUpdate();
				} else {
					await interaction.deferReply();
				}
			} else if ("update" in interaction && message) {
				if (flags)
					throw new ConfigError(
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
			if (
				(!routeResponse?.timeout || !isFinite(routeResponse?.timeout)) &&
				(routeResponse?.cleanup || session.has())
			)
				throw new ConfigError(
					"Timeout is required for components using cleanups or sessions",
				);
			// Always start cleanup if timeout provided
			if (!routeResponse?.timeout || !isFinite(routeResponse?.timeout)) return;

			message =
				message ??
				(await interaction.fetchReply().catch(() => {
					throw new ConfigError(
						"RouteRender can only be undefined for interactions that already have messages",
					);
				}));
			const resolvedMessage = message;

			const channel = interaction.channel;
			const applyFn: ApplyHandler | undefined = resolvedMessage.flags.has(
				MessageFlags.Ephemeral,
			)
				? interaction.editReply.bind(interaction)
				: channel
					? (options) => channel.messages.edit(resolvedMessage.id, options)
					: undefined;
			if (!applyFn)
				process.emitWarning(
					`Could not derive applyFunction for ${pathToString(path, false)}. Cleanup return results will not be applied to message.`,
					"DiscordEmbedRouterWarning",
				);

			this.#sessionManager.commit(interaction, resolvedMessage.id);
			this.#cleanupManager.register(resolvedMessage.id, {
				interaction,
				cleanupFn: routeResponse.cleanup?.bind(routeResponse),
				applyFn,
				timeout: routeResponse.timeout,
				route: { method, path: pathToString(path, false) },
			});
		} finally {
			if (!message || !this.#cleanupManager.has(message.id)) {
				// no cleanup was set, drop the working session copy
				this.#sessionManager.discard(interaction);
			}
		}
	}

	/**
	 * Attached to "interactionCreate" event to detect our custom RouteComponents
	 *
	 * @param interaction interactions from "interactionCreate" (filter for ButtonInteractions)
	 */
	async #listener(interaction: Interaction) {
		// set once decoding succeeds, so a wrapped error can name the route
		// even though this interaction never went through a user's own call site
		let route: { method: Method; path: string } | undefined;
		try {
			if (
				!this.isSupportedInteraction(interaction) ||
				interaction.isChatInputCommand()
			)
				return;
			if (!interaction.customId.startsWith(this.#idPrefix)) return; // don't throw any errors

			// modal submits shown from a command have no message; key the queue by
			// interaction so they don't contend with anything
			const messageId = interaction.message?.id ?? interaction.id;
			// another interaction on this message is still being handled; ack
			// immediately so this one doesn't blow its own 3s window while queued
			if (this.#messageQueue.isBusy(messageId)) await interaction.deferUpdate();

			await this.#messageQueue.run(messageId, async () => {
				const res = this.#interactionDecoder.decode(interaction, this.idPrefix);
				if (!res)
					throw new Error(
						`Invalid component found: id ${interaction.customId}`,
					);
				route = res;

				await this.dispatch(interaction, res.path, {
					method: res.method,
					locals: this.#localsProvider?.(this, interaction),
				});
			});
		} catch (e: unknown) {
			if (e instanceof ConfigError) throw e;
			this.emit(
				"routeError",
				route
					? new Error(
							`Error while handling ${route.method} ${pathToString(route.path, false)}`,
							{ cause: toError(e) },
						)
					: toError(e),
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
			interaction.isMessageComponent() ||
			interaction.isChatInputCommand() ||
			interaction.isModalSubmit()
		);
	}

	/**
	 * Resolves a route to the associated message (DOES NOT UPDATE MESSAGE)
	 *
	 * @param interaction interaction to connect to
	 * @param path path to route the interaction to
	 * @param method method to send to route
	 * @param locals additional info to pass in to page through state.local (optional)
	 * @param session session handle already opened for this interaction
	 * @returns discord message associated with route OR false
	 */
	async #resolve<P extends Path = Path>(
		path: P,
		{
			interaction,
			method = "GET",
			locals,
			session,
		}: {
			interaction: Interaction;
			method?: Method;
			locals: Locals | undefined;
			session: SessionHandle<Session>;
		},
	): Promise<
		| { message: RouteRender<Globals, Session, Locals> | undefined }
		| { modal: ModalRender<Globals, Session, Locals> | undefined }
		| false
	> {
		if (!this.isSupportedInteraction(interaction)) return false;

		let currentPath: Path = path;
		let currentMethod = method;

		for (let hop = 0; ; hop++) {
			if (hop >= MAX_REDIRECTS)
				throw new ConfigError(
					`Too many redirects while resolving ${pathToString(path, false)}`,
				);

			// don't check validity because query params are considered invalid
			const pathString = pathToString(currentPath, false);
			const location = new Location(pathString);

			let routeResult:
				| RouteResult<Globals, Session, Locals>
				| ModalResult<Globals, Session, Locals>
				| undefined;
			let matched = false;
			for (const route of this.#routes.get(currentMethod) ?? []) {
				const result = route.matchFunction(location.pathname);
				if (!result) continue;
				matched = true;

				const state = {
					...(result as MatchResult<ExtractParams<P>>),
					queryParams: location.queryParams,
					globals: this.#globals,
					locals,
					fields: interaction.isModalSubmit() ? interaction.fields : undefined,
					// MODAL handlers may read the session (e.g. to prefill inputs)
					// but nothing commits on the showModal path, so writes throw
					session:
						currentMethod === "MODAL"
							? this.#sessionManager.readOnly(session)
							: session,
				};

				// showing a modal never touches the message, so the previous
				// render's cleanup is not preempted: it keeps running until the
				// next non-MODAL dispatch or its own timeout
				if (currentMethod !== "MODAL") {
					const messageId =
						"message" in interaction ? interaction.message?.id : undefined;
					if (messageId !== undefined)
						await this.#cleanupManager.run(messageId, state);
				}

				routeResult = await route.handler(this, interaction, state);
				break;
			}
			if (!matched) return false;

			if (routeResult && "redirect" in routeResult) {
				currentPath = routeResult.redirect;
				currentMethod = "GET";
				continue;
			}

			// terminal results are tagged by kind (a modal payload is a plain
			// object with no runtime discriminator, and each kind's undefined
			// silent-ack takes a different path in dispatch)
			if (currentMethod === "MODAL") {
				// cleanup/timeout only make sense on a message render; catch them
				// here so a JS caller doesn't have them silently dropped by showModal
				if (
					routeResult &&
					("cleanup" in routeResult || "timeout" in routeResult)
				)
					throw new ConfigError(
						`Route handler for MODAL ${pathToString(currentPath, false)} must not set cleanup or timeout; showing a modal never edits the message, so there is nothing for them to guard`,
					);
				return {
					modal: routeResult as
						ModalRender<Globals, Session, Locals> | undefined,
				};
			}

			// catches a JS caller (or an `as any`) returning content from a non-GET handler
			if (routeResult && currentMethod !== "GET")
				throw new ConfigError(
					`Route handler for ${currentMethod} ${pathToString(currentPath, false)} must return a redirect or undefined, not content`,
				);

			return {
				message: routeResult as
					RouteRender<Globals, Session, Locals> | undefined,
			};
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
			throw new ConfigError(
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
