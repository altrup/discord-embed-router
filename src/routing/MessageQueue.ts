import type { Snowflake } from "discord.js";

/**
 * Serializes async work per message id, so two interactions targeting the
 * same message (e.g. a double click) can't interleave their reads/writes of
 * that message's session data.
 */
export class MessageQueue {
	#busy = new Set<Snowflake>();
	#tail = new Map<Snowflake, Promise<unknown>>();

	/**
	 * Returns whether a message currently has queued or in-progress work.
	 *
	 * @param messageId the message to check
	 * @returns whether the message is busy
	 */
	public isBusy(messageId: Snowflake): boolean {
		return this.#busy.has(messageId);
	}

	/**
	 * Queues `task` to run for `messageId`, after any earlier task queued for
	 * the same message has settled.
	 *
	 * @param messageId the message to serialize this task against
	 * @param task the work to run once it's this message's turn
	 * @returns a promise for this task's own result
	 */
	public run<T>(messageId: Snowflake, task: () => Promise<T>): Promise<T> {
		const prior = this.#tail.get(messageId) ?? Promise.resolve();
		this.#busy.add(messageId);
		const settled = prior.then(task, task).finally(() => {
			if (this.#tail.get(messageId) === settled) {
				this.#busy.delete(messageId);
				this.#tail.delete(messageId);
			}
		});
		this.#tail.set(messageId, settled);
		return settled;
	}
}
