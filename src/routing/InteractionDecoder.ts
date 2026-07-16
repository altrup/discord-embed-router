import { Interaction } from "discord.js";
import { compile } from "path-to-regexp";

import type { Encoder } from "@encoding/Encoder";
import { Location } from "@helpers/Location";
import { decodePuaNumber } from "@helpers/puaCodepoints";
import { REPLY_FLAGS } from "@routing/consts";
import type { Method } from "@routing/types";
import { FLAGS_QUERY_PARAM, KEY_QUERY_PARAM } from "@src/consts";

/**
 * Turns a discord.js component or modal submit interaction that came from one
 * of this package's component builders back into `{ method, path }`, using
 * the given `Encoder` to decode the raw customId(s).
 */
export class InteractionDecoder {
	#encoder: Encoder;

	constructor(encoder: Encoder) {
		this.#encoder = encoder;
	}

	/**
	 * Decodes an interaction that came from a componentBuilder in this package.
	 *
	 * @param interaction the interaction from discord.js to decode
	 * @param idPrefix string that the encoded customId was prefixed with
	 * @returns the method and path that was encoded from the interaction
	 */
	public decode(
		interaction: Interaction,
		idPrefix: string,
	):
		| { method: Method; path: string; values?: string[]; flags?: number }
		| false {
		if (!interaction.isMessageComponent() && !interaction.isModalSubmit())
			return false;

		const customId = interaction.customId;
		if (!customId.startsWith(idPrefix)) return false;

		const decodedPath = this.#encoder.decodePath(interaction.customId, {
			idPrefix,
		});
		if (decodedPath === false) return false;

		if (interaction.isButton() || interaction.isModalSubmit()) {
			// carried reply flags only ever apply to a modal submission: every
			// other component lives on a message, so its dispatch never creates
			// the reply the flags would style. Never paired with a MODAL method
			// (only reachable by a forged customId; RouteModalBuilder rejects
			// MODAL) — dispatch()'s options type relies on that invariant
			const flags =
				interaction.isModalSubmit() && decodedPath.method !== "MODAL"
					? this.#extractFlags(decodedPath.path)
					: undefined;
			return {
				method: decodedPath.method,
				path: this.#fillParams(decodedPath.path, {
					ts: interaction.createdTimestamp.toString(),
				}).toString(),
				...(flags !== undefined && { flags }),
			};
		} else if (interaction.isAnySelectMenu()) {
			if (interaction.values.length === 0) {
				try {
					return {
						method: decodedPath.method,
						path: this.#fillParams(decodedPath.path, {
							ts: interaction.createdTimestamp.toString(),
						}).toString(),
						values: [],
					};
				} catch {
					return false;
				}
			}

			if (interaction.isStringSelectMenu()) {
				const decodedOptions = interaction.values
					.map((v) =>
						this.#encoder.decodePath(v, {
							idPrefix: "",
							allowEmptyMethod: true,
						}),
					)
					.filter((r) => r !== false);
				const toLocations = decodedOptions.map((r) =>
					this.#fillParams(r.path, {
						ts: interaction.createdTimestamp.toString(),
					}),
				);
				// only the first selected option drives :to/*to and the merged
				// query params; every option's destination is still available
				// via state.values for handlers that need the rest
				const firstToLocation = toLocations[0];
				const toSegments = firstToLocation?.pathname
					.split("/")
					.filter((s) => s.length > 0);
				const pathLocation = this.#fillParams(
					decodedPath.path,
					{
						ts: interaction.createdTimestamp.toString(),
						// path-to-regexp throws on [], not just missing, for a wildcard param
						to: toSegments?.length ? toSegments : undefined,
					},
					{
						ts: interaction.createdTimestamp.toString(),
						to: firstToLocation?.pathname,
					},
				);

				for (const [key, value] of firstToLocation?.queryParams ?? []) {
					pathLocation.queryParams.append(key, value);
				}
				return {
					// an option can override the method for just that entry;
					// otherwise fall back to the select menu's own pattern method
					method: decodedOptions[0]?.method || decodedPath.method,
					path: pathLocation.toString(),
					values: toLocations.map((l) => l.toString()),
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
				}).toString(),
				values: interaction.values,
			};
		}

		return false;
	}

	// reads the reserved flags param and re-masks it to the reply-settable
	// bits, so a forged or garbled customId can't smuggle arbitrary flags
	#extractFlags(path: string): number | undefined {
		const encoded = new Location(path).queryParams.get(FLAGS_QUERY_PARAM);
		if (encoded === null) return undefined;
		const decoded = decodePuaNumber(encoded);
		if (decoded === undefined) return undefined;
		const masked = decoded & REPLY_FLAGS;
		return masked === 0 ? undefined : masked;
	}

	#fillParams(
		path: string,
		params: Partial<Record<string, string | string[]>> = {},
		queryParams = params,
	): Location {
		const location = new Location(path);
		// the reserved params already did their jobs (the key making the
		// customId unique, the flags extracted before this call); drop them so
		// handlers and select menu values never see them
		location.queryParams.delete(KEY_QUERY_PARAM);
		location.queryParams.delete(FLAGS_QUERY_PARAM);
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
}
