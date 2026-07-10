import type { Interaction, Snowflake } from "discord.js";

import { toError } from "@helpers/toError";
import type { State } from "@routing/types";
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
	 * @param opts the interaction that triggered the response, its cleanup/apply handlers, and the timeout to run them after
	 */
	public register(
		messageId: Snowflake,
		opts: {
			interaction: Interaction;
			cleanupFn: CleanupHandler<Globals, Session, Locals> | undefined;
			applyFn: ApplyHandler | undefined;
			timeout: number;
		},
	) {
		this.remove(messageId);

		this.#cleanups.set(messageId, {
			interaction: opts.interaction,
			cleanupFn: opts.cleanupFn,
			applyFn: opts.applyFn,
			// nothing awaits this timer, so a rethrown ConfigError has no
			// caller to catch it -- report instead of letting it go unhandled
			timer: setTimeout(() => {
				this.run(messageId, undefined).catch((e: unknown) =>
					this.#onError(toError(e), opts.interaction),
				);
			}, opts.timeout),
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
			if (result && isTimeout) {
				await cleanup
					.applyFn?.(result)
					.catch((e: unknown) =>
						this.#onError(toError(e), cleanup.interaction),
					);
			}
		} catch (e: unknown) {
			if (e instanceof ConfigError) throw e;
			this.#onError(toError(e), cleanup.interaction);
		}
	}
}
