import path from "node:path";

import type { Interaction } from "discord.js";
import { match, MatchResult, Path } from "path-to-regexp";

import type { Encoder } from "@encoding/Encoder";
import { isSupportedInteraction } from "@helpers/isSupportedInteraction";
import { Location } from "@helpers/Location";
import { pathToString } from "@helpers/pathToString";
import type { EmbedRouter } from "@routing/EmbedRouter";
import type {
	CompiledRoute,
	ExtractParams,
	Method,
	ModalRender,
	ModalResult,
	RouteHandler,
	RouteRender,
	RouteResult,
} from "@routing/types";
import { CleanupManager } from "@sessions/CleanupManager";
import { SessionManager } from "@sessions/SessionManager";
import { ConfigError } from "@src/ConfigError";

// guards against a route handler that redirects into a cycle
const MAX_REDIRECTS = 10;

/**
 * Owns a router's routes: registering them (encoding their path segments
 * along the way) and resolving a path/method against them, following
 * redirects until a terminal render, modal, or "no route" result comes
 * back. Registration and resolution share the same routes map, so they're
 * kept together rather than split across two objects that would otherwise
 * just pass it back and forth.
 */
export class RouteRegistry<Globals, Session, Locals> {
	#embedRouter: EmbedRouter<Globals, Session, Locals>;
	#encoder: Encoder;
	#sessionManager: SessionManager<Session>;
	#cleanupManager: CleanupManager<Globals, Session, Locals>;
	#getGlobals: () => Globals | undefined;
	#routes: Map<Method, CompiledRoute<Method, Globals, Session, Locals>[]> =
		new Map();

	constructor(
		embedRouter: EmbedRouter<Globals, Session, Locals>,
		encoder: Encoder,
		sessionManager: SessionManager<Session>,
		cleanupManager: CleanupManager<Globals, Session, Locals>,
		getGlobals: () => Globals | undefined,
	) {
		this.#embedRouter = embedRouter;
		this.#encoder = encoder;
		this.#sessionManager = sessionManager;
		this.#cleanupManager = cleanupManager;
		this.#getGlobals = getGlobals;
	}

	/**
	 * Registers a route, encoding its path segment(s) with the router's
	 * encoder.
	 *
	 * @param method method to register the route under
	 * @param routePath path (or paths) to match with
	 * @param handler function to run when the route matches
	 */
	public addRoute<M extends Method, P extends Path = Path>(
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

		if (Array.isArray(routePath)) {
			routePath.forEach((p) => this.#encoder.registerPath(p));
		} else {
			this.#encoder.registerPath(routePath);
		}
	}

	/**
	 * Copies another registry's routes in under a path prefix.
	 *
	 * @param routePath prefix to mount the other registry's routes at
	 * @param other registry whose routes should be copied in
	 */
	public use<P extends Path = Path>(
		routePath: P,
		other: RouteRegistry<Globals, Session, Locals>,
	) {
		const pathString = pathToString(routePath);
		for (const [method, routes] of other.#routes) {
			for (const route of routes) {
				this.addRoute(
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
	 * Drops every registered route.
	 */
	public clear() {
		this.#routes.clear();
	}

	/**
	 * Resolves a route to the associated message (DOES NOT UPDATE MESSAGE)
	 *
	 * @param path path to route the interaction to
	 * @param interaction interaction to connect to
	 * @param method method to send to route
	 * @param locals additional info to pass in to page through state.local (optional)
	 * @returns discord message associated with route OR false
	 */
	public async resolve<P extends Path = Path>(
		path: P,
		{
			interaction,
			method = "GET",
			locals,
			values,
		}: {
			interaction: Interaction;
			method?: Method;
			locals: Locals | undefined;
			values?: string[] | undefined;
		},
	): Promise<
		| { message: RouteRender<Globals, Session, Locals> | undefined }
		| { modal: ModalRender<Globals, Session, Locals> | undefined }
		| false
	> {
		if (!isSupportedInteraction(interaction)) return false;

		let currentPath: Path = path;
		let currentMethod = method;

		for (let hop = 0; ; hop++) {
			if (hop >= MAX_REDIRECTS)
				throw new ConfigError(`Too many redirects`, { method, path });

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

				const messageId =
					"message" in interaction ? interaction.message?.id : undefined;

				const state = {
					...(result as MatchResult<ExtractParams<P>>),
					queryParams: location.queryParams,
					globals: this.#getGlobals(),
					locals,
					fields: interaction.isModalSubmit() ? interaction.fields : undefined,
					values,
				};

				// only a GET hop can produce (or replace) a render, so the
				// previous render's cleanup is only preempted there: a MODAL
				// never touches the message, and a mutation that doesn't
				// redirect into a GET leaves the message, and its cleanup,
				// untouched too
				if (messageId !== undefined) {
					const oldInteraction = this.#cleanupManager.interactionFor(messageId);

					if (oldInteraction) {
						this.#sessionManager.persist(oldInteraction, messageId);
					}
					if (currentMethod === "GET") {
						await this.#cleanupManager.run(messageId, {
							...state,
							// oldInteraction: session is committed in cleanup
							// interaction: session is reused for handler
							session: this.#sessionManager.open(
								oldInteraction ?? interaction,
								messageId,
							),
						});
					}
				}

				routeResult = await route.handler(this.#embedRouter, interaction, {
					...state,
					session:
						currentMethod === "MODAL"
							? this.#sessionManager.readOnly(
									this.#sessionManager.open(interaction, messageId),
								)
							: this.#sessionManager.open(interaction, messageId),
				});
				break;
			}
			if (!matched) return false;

			if (routeResult && "redirect" in routeResult) {
				if ("cleanup" in routeResult || "timeout" in routeResult)
					throw new ConfigError(
						"cleanup and timeout are not supported in redirects",
						{ method, path },
					);
				// only reachable by a JS caller (or an `as any`) bypassing the
				// type: anything else would be calling another mutation, not
				// handing off rendering
				if (
					routeResult.method !== undefined &&
					routeResult.method !== "GET" &&
					routeResult.method !== "MODAL"
				)
					throw new ConfigError(
						`A redirect can only target GET or MODAL, not "${routeResult.method}"`,
						{ method, path },
					);
				currentPath = routeResult.queryParams
					? new Location(
							pathToString(routeResult.redirect, false),
							routeResult.queryParams,
						).toString()
					: routeResult.redirect;
				currentMethod = routeResult.method ?? "GET";
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
						`Route handler for MODAL does not support cleanup or timeout`,
						{ method, path },
					);
				return {
					modal: routeResult as
						ModalRender<Globals, Session, Locals> | undefined,
				};
			}

			// a redirect (the only valid non-GET result) already continued the
			// loop above, so reaching here with a non-GET method means the
			// handler returned content, or nothing at all
			if (currentMethod !== "GET")
				throw new ConfigError(`Non-GET route handlers must return a redirect`, {
					method,
					path,
				});

			return {
				message: routeResult as
					RouteRender<Globals, Session, Locals> | undefined,
			};
		}
	}
}
