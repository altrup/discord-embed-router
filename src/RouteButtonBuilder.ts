import { APIButtonComponent, ButtonBuilder } from "discord.js";
import { Path } from "path-to-regexp";
import { BASE_URL } from "./consts";
import { pathToString } from "./helpers/pathToString";
import { EmbedRouter } from "./EmbedRouter";

export class RouteButtonBuilder extends ButtonBuilder {
	constructor(data?: Omit<Partial<APIButtonComponent>, "custom_id" | "url">) {
		super(data);
	}

	/**
	 * Not supported for RouteButtonBuilder
	 *
	 * @remarks
	 * @param
	 */
	override setURL(): this {
		throw new Error("setURL is not supported on RouteButtonBuilder");
	}

	/**
	 * Not supported for RouteButtonBuilder (setTo uses customId)
	 *
	 * @remarks
	 * @param
	 */
	override setCustomId(): this {
		throw new Error("setCustomId is not supported on RouteButtonBuilder");
	}

	/**
	 * Sets the path to route to when clicked
	 *
	 * @param path the path to route to
	 * @param idPrefix the prefix to add before the custom_id
	 */
	setTo<P extends Path, L>(embedRouter: EmbedRouter<L>, path: P, query?: ConstructorParameters<typeof URLSearchParams>[0]): this {
		const idPrefix = embedRouter.getIdPrefix();

		// don't check validity because url params are considered invalid
		const url = new URL(pathToString(path, false), BASE_URL);
		if (query) {
			for (const [key, value] of new URLSearchParams(query)) {
				url.searchParams.set(key, value);
			}
		}
		const customId = `${idPrefix}${url.pathname}${url.search}`;
		super.setCustomId(customId);

		return this;
	}
}
