import { StringSelectMenuOptionBuilder } from "discord.js";
import { Path } from "path-to-regexp";
import { encodePath } from "../helpers/encodePath";
import { RouteOptions } from "../types/componentBuilders";

export class RouteStringSelectMenuOptionBuilder extends StringSelectMenuOptionBuilder {
	/**
	 * Not supported for RouteStringSelectMenuOptionBuilder (use setTo)
	 *
	 * @remarks
	 * @param
	 */
	override setValue(): this {
		throw new Error(
			"setValue is not supported on RouteStringSelectMenuOptionBuilder",
		);
	}

	/**
	 * Sets the path to route to when selected
	 *
	 * @param path the path to route to, can include :ts
	 * @param query any query parameters you want to add, can include :ts
	 * @param method method to send to route
	 */
	public setTo<P extends Path>(
		path: P,
		{ method = "", query }: RouteOptions<true> = {},
	): this {
		super.setValue(
			encodePath<true>({
				idPrefix: "",
				method,
				path,
				query,
			}),
		);

		return this;
	}
}
