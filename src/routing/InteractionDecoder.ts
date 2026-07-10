import { Interaction } from "discord.js";
import { compile } from "path-to-regexp";

import type { Encoder } from "@encoding/Encoder";
import { Location } from "@helpers/Location";
import type { Method } from "@routing/types";

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
	): { method: Method; path: string } | false {
		if (!interaction.isMessageComponent() && !interaction.isModalSubmit())
			return false;

		const customId = interaction.customId;
		if (!customId.startsWith(idPrefix)) return false;

		const decodedPath = this.#encoder.decodePath(interaction.customId, {
			idPrefix,
		});
		if (decodedPath === false) return false;

		if (interaction.isButton() || interaction.isModalSubmit()) {
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
}
