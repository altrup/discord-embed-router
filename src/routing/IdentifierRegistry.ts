import { puaCodepointsFrom } from "@helpers/puaCodepoints";
import { ConfigError } from "@src/ConfigError";
import { PUA_RANGE } from "@src/consts";

// anything that can hold a PUA identifier and be asked to find itself a new
// one when it's evicted to make room for a name collision
export interface IdentifierHolder {
	readonly name: string;
	reassignIdentifier(): void;
}

/**
 * Allocates single-character Private Use Area identifiers to routers,
 * deterministically derived from each router's name so it stays stable
 * across restarts. Shared across every router, since the identifier space
 * (and the collision policy across it) is global, not per-instance.
 */
export class IdentifierRegistry {
	#holders = new Map<string, IdentifierHolder>();

	/**
	 * Finds an available identifier for `holder`, evicting an unnamed
	 * holder's claim on its preferred slot if one is in the way.
	 *
	 * @param holder the holder to allocate an identifier for
	 * @returns the allocated identifier
	 */
	public acquire(holder: IdentifierHolder): string {
		if (this.#holders.size >= PUA_RANGE)
			throw new ConfigError(`You can not have more than ${PUA_RANGE} routers`);

		let char: string | undefined;
		const nameCollisions: IdentifierHolder[] = [];
		// find next available identifier; the size check above guarantees the
		// generator (which cycles through the whole space before repeating)
		// finds one within PUA_RANGE candidates
		for (const candidate of puaCodepointsFrom(holder.name)) {
			const collision = this.#holders.get(candidate);
			if (collision === undefined) {
				char = candidate;
				break;
			}

			if (holder.name.length > 0 && collision.name.length === 0) {
				// evict old name; the map entry is overwritten below once this
				// holder claims the same slot
				collision.reassignIdentifier();
				char = candidate;
				break;
			}

			nameCollisions.push(collision);
		}
		if (char === undefined)
			throw new ConfigError(
				"Internal error: no available identifier found despite passing the capacity check",
			);
		this.#holders.set(char, holder);

		if (nameCollisions.length > 0 && holder.name.length > 0) {
			process.emitWarning(
				`EmbedRouter identifier collision for name "${holder.name}" with ${nameCollisions.map((c) => `"${c.name}"`).join(", ")}`,
				"DiscordEmbedRouterWarning",
			);
		}
		return char;
	}

	/**
	 * Releases a previously acquired identifier.
	 *
	 * @param char the identifier to release
	 */
	public release(char: string) {
		this.#holders.delete(char);
	}
}
