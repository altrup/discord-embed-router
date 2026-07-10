import type { Interaction, Snowflake } from "discord.js";

import type { SessionHandle } from "@sessions/types";
import { ConfigError } from "@src/ConfigError";

/**
 * Stores session data for a router. Callers never need to know whether a
 * message exists yet: `open()` hands back a handle backed by a working copy
 * for the interaction, seeded from the message's session if one already
 * exists; `commit()` reconciles that working copy into the durable,
 * message-keyed store once the interaction's message is known.
 */
export class SessionManager<Session> {
	// message.id -> committed session
	#sessions = new Map<Snowflake, Session>();
	// interaction.id -> working copy, alive for the duration of one dispatch
	#staging = new Map<Snowflake, Session>();
	// interaction ids with a still-open handle; a handle closes once its
	// dispatch commits or discards it, so a reference held past that (e.g. in
	// a caller's own setTimeout) throws instead of silently reading stale
	// data or leaking a write back into #staging that nothing will ever commit
	#open = new Set<Snowflake>();

	/**
	 * Starts tracking session state for an interaction, seeding it from the
	 * message's existing session if one is already known.
	 *
	 * @param interaction the interaction session state is being opened for
	 * @param messageId the interaction's message, if already known
	 * @returns a handle bound to this interaction's working copy
	 */
	public open(
		interaction: Interaction,
		messageId: Snowflake | undefined,
	): SessionHandle<Session> {
		const existing =
			messageId !== undefined ? this.#sessions.get(messageId) : undefined;
		if (existing !== undefined) this.#staging.set(interaction.id, existing);
		this.#open.add(interaction.id);
		return this.#handleFor(this.#staging, interaction.id);
	}

	/**
	 * Reconciles the working copy for `interaction` into the durable,
	 * message-keyed store, and closes its handle.
	 *
	 * @param interaction the interaction whose working copy should be committed
	 * @param messageId the message to commit the session under
	 */
	public commit(interaction: Interaction, messageId: Snowflake) {
		this.#open.delete(interaction.id);
		const staged = this.#staging.get(interaction.id);
		this.#staging.delete(interaction.id);
		if (staged === undefined) {
			this.#sessions.delete(messageId);
			return;
		}
		this.#sessions.set(messageId, staged);
	}

	/**
	 * Drops the working copy without committing it, and closes its handle,
	 * e.g. when no cleanup ends up being registered.
	 *
	 * @param interaction the interaction whose working copy should be dropped
	 */
	public discard(interaction: Interaction) {
		this.#open.delete(interaction.id);
		this.#staging.delete(interaction.id);
	}

	/**
	 * Deletes a message's committed session.
	 *
	 * @param messageId the message whose session should be deleted
	 */
	public deleteForMessage(messageId: Snowflake) {
		this.#sessions.delete(messageId);
	}

	#handleFor(
		store: Map<Snowflake, Session>,
		id: Snowflake,
	): SessionHandle<Session> {
		const guarded = <T>(fn: () => T): T => {
			if (!this.#open.has(id))
				throw new ConfigError(
					"This session handle's interaction has already been committed or discarded, and can no longer be read or written",
				);
			return fn();
		};

		return {
			// cloned so handlers can't mutate stored session data without going through set()
			get: () =>
				guarded(() => {
					const value = store.get(id);
					return value === undefined ? undefined : structuredClone(value);
				}),
			has: () => guarded(() => store.has(id)),
			set: (session: Session) => guarded(() => void store.set(id, session)),
			delete: () => guarded(() => store.delete(id)),
		};
	}
}
