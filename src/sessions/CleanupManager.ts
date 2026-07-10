import type { Interaction, Snowflake } from "discord.js";

import { toError } from "@helpers/toError";
import type { Method, State } from "@routing/types";
import type { SessionManager } from "@sessions/SessionManager";
import type { ApplyHandler, CleanupHandler } from "@sessions/types";
import { ConfigError } from "@src/ConfigError";

/**
 * Owns the timeout/cleanup lifecycle for messages. Session storage is a
 * separate concern (see SessionManager); this class only needs it to clear
 * a message's session on a real timeout — a cleanup handler's own session
 * access comes from its closure, not from anything injected here.
 */
export class CleanupManager<Globals, Session, Locals> {
	#cleanups = new Map<
		Snowflake,
		{
			interaction: Interaction;
			timer: NodeJS.Timeout;
			cleanupFn: CleanupHandler<Globals, Session, Locals> | undefined;
			applyFn: ApplyHandler | undefined;
			// the route that registered this cleanup, so a late-firing error can
			// still name its route even though nothing on the stack does anymore
			route: { method: Method; path: string };
		}
	>();

	#sessions: SessionManager<Session>;
	#onError: (err: Error, interaction: Interaction) => void;

	constructor(
		sessions: SessionManager<Session>,
		onError: (err: Error, interaction: Interaction) => void,
	) {
		this.#sessions = sessions;
		this.#onError = onError;
	}

	/**
	 * Returns whether a message currently has a registered cleanup.
	 *
	 * @param messageId the message to check
	 * @returns whether a cleanup is registered
	 */
	public has(messageId: Snowflake): boolean {
		return this.#cleanups.has(messageId);
	}

	/**
	 * Registers a cleanup for a message. Any existing cleanup for the message
	 * is assumed to have already been run (with the new state) by the caller
	 * before the new route handler ran — this just cancels its timer so it
	 * doesn't leak.
	 *
	 * @param messageId the message to register a cleanup for
	 * @param interaction the interaction that triggered the response
	 * @param cleanupFn the cleanup handler to run
	 * @param applyFn the handler to apply cleanupFn's result to the message
	 * @param timeout how long to wait before running the cleanup
	 * @param route the method and path that registered this cleanup
	 */
	public register(
		messageId: Snowflake,
		{
			interaction,
			cleanupFn,
			applyFn,
			timeout,
			route,
		}: {
			interaction: Interaction;
			cleanupFn: CleanupHandler<Globals, Session, Locals> | undefined;
			applyFn: ApplyHandler | undefined;
			timeout: number;
			route: { method: Method; path: string };
		},
	) {
		this.remove(messageId);

		this.#cleanups.set(messageId, {
			interaction,
			cleanupFn,
			applyFn,
			route,
			// nothing awaits this timer, so a rethrown ConfigError has no
			// caller to catch it -- report instead of letting it go unhandled
			timer: setTimeout(() => {
				this.run(messageId, undefined).catch((e: unknown) =>
					this.#report(e, interaction, route),
				);
			}, timeout),
		});
	}

	/**
	 * Cancels a message's registered cleanup without running it.
	 *
	 * @param messageId the message whose cleanup should be canceled
	 */
	public remove(messageId: Snowflake) {
		clearTimeout(this.#cleanups.get(messageId)?.timer);
		this.#cleanups.delete(messageId);
	}

	/**
	 * Runs a message's registered cleanup, if any, and cancels its timer.
	 *
	 * @param messageId the message whose cleanup should run
	 * @param newState the state of the interaction taking over, or undefined on a real timeout
	 */
	public async run(
		messageId: Snowflake,
		newState: State<Globals, Session, Locals> | undefined,
	) {
		const cleanup = this.#cleanups.get(messageId);
		if (!cleanup) return;
		clearTimeout(cleanup.timer);
		this.#cleanups.delete(messageId);

		const isTimeout = newState === undefined;
		// only a real timeout means nobody is coming back to this message
		if (isTimeout) this.#sessions.deleteForMessage(messageId);

		try {
			const result = await cleanup.cleanupFn?.(newState);
			if (result && isTimeout) await cleanup.applyFn?.(result);
		} catch (e: unknown) {
			if (e instanceof ConfigError) throw e;
			this.#report(e, cleanup.interaction, cleanup.route);
		}
	}

	// wraps with the route that registered the cleanup, since by the time a
	// timeout or an applyFn rejection surfaces, nothing on the stack knows
	// which route that was anymore
	#report(
		e: unknown,
		interaction: Interaction,
		route: { method: Method; path: string },
	) {
		this.#onError(
			new Error(`Error while handling ${route.method} ${route.path}`, {
				cause: toError(e),
			}),
			interaction,
		);
	}
}
