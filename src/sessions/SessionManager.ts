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
	// interaction ids with a still-open handle
	// we don't use #staging, so people are free to delete at choice
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
		if (!this.#open.has(interaction.id)) {
			const existing =
				messageId !== undefined ? this.#sessions.get(messageId) : undefined;
			if (existing !== undefined) this.#staging.set(interaction.id, existing);
			this.#open.add(interaction.id);
		}
		return this.#handleFor(this.#staging, interaction.id);
	}

	/**
	 * Checks if an interaction has an active session
	 *
	 * @param interaction the interaction to check
	 * @returns if interaction has an active session
	 */
	public hasSession(interaction: Interaction): boolean {
		return this.#staging.has(interaction.id);
	}

	/**
	 * Writes the working copy for `interaction` into the durable,
	 * message-keyed store, without closing its handle. Lets a session set
	 * during a render that also registers a cleanup be visible to other
	 * reads right away, while the cleanup may still read or write it later.
	 *
	 * @param interaction the interaction whose working copy should be persisted
	 * @param messageId the message to persist the session under
	 */
	public persist(interaction: Interaction, messageId: Snowflake) {
		const staged = this.#staging.get(interaction.id);
		if (staged === undefined) {
			this.#sessions.delete(messageId);
			return;
		}
		this.#sessions.set(messageId, staged);
	}

	/**
	 * Reconciles the working copy for `interaction` into the durable,
	 * message-keyed store, and closes its handle.
	 *
	 * @param interaction the interaction whose working copy should be committed
	 * @param messageId the message to commit the session under
	 */
	public commit(interaction: Interaction, messageId: Snowflake) {
		this.persist(interaction, messageId);
		this.#open.delete(interaction.id);
		this.#staging.delete(interaction.id);
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

	/**
	 * Drops every committed and staged session, closing all open handles.
	 */
	public clearAll() {
		this.#sessions.clear();
		this.#staging.clear();
		this.#open.clear();
	}

	/**
	 * Wraps a handle so reads pass through and writes throw, for handlers on
	 * a path where nothing would ever commit a write (showing a modal).
	 *
	 * @param session the handle to wrap
	 * @returns a handle whose set/delete throw a ConfigError
	 */
	public readOnly(session: SessionHandle<Session>): SessionHandle<Session> {
		const write = () => {
			throw new ConfigError(
				"MODAL handlers can not write to the session; nothing is committed when showing a modal. Write it in the render offering the modal, or in the route processing its submission",
			);
		};
		return {
			get: () => session.get(),
			has: () => session.has(),
			set: write,
			delete: write,
		};
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
			get: () => guarded(() => store.get(id)),
			has: () => guarded(() => store.has(id)),
			set: (session: Session) => guarded(() => void store.set(id, session)),
			delete: () => guarded(() => store.delete(id)),
		};
	}
}
