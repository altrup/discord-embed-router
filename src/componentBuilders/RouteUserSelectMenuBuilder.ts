import { UserSelectMenuBuilder, UserSelectMenuComponentData } from "discord.js";
import { Path } from "path-to-regexp";

import { rejectKeys } from "@componentBuilders/rejectKeys";
import type { EmbedRouter } from "@routing/EmbedRouter";
import { RouteOptions } from "@routing/types";
import { ConfigError } from "@src/ConfigError";

// path params this builder embeds into paths handed to encodePath
export const ROUTE_USER_SELECT_MENU_BUILDER_PARAMS = [
	":ts",
	":userId",
] as const;

export class RouteUserSelectMenuBuilder<
	Globals = unknown,
	Session = unknown,
	Locals = unknown,
	P extends Path = Path,
> extends UserSelectMenuBuilder {
	#embedRouter: EmbedRouter<Globals, Session, Locals>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<Globals, Session, Locals>,
		data?: Omit<UserSelectMenuComponentData, "customId"> & {
			pattern?: P | undefined;
			patternOptions?: RouteOptions<true> | undefined;
		},
	) {
		const { pattern, patternOptions, ...rest } = data ?? {};
		rejectKeys(rest, ["custom_id", "customId"], "RouteUserSelectMenuBuilder");
		super(rest);

		this.#embedRouter = embedRouter;
		if (pattern) this.setPattern(pattern, patternOptions);
	}

	/**
	 * Not supported for RouteUserSelectMenuBuilder (customId set from embedRouter)
	 *
	 * @param
	 */
	override setCustomId(): this {
		throw new ConfigError(
			"setCustomId is not supported on RouteUserSelectMenuBuilder",
		);
	}

	/**
	 * Sets the pattern to redirect to (Required)
	 *
	 * @param path the path to redirect to, can include :ts :userId
	 * @param queryParams any query parameters you want to add, can include :ts :userId
	 * @param method method to send to route
	 */
	public setPattern(
		path: P,
		{ method = "GET", queryParams }: RouteOptions<true> = {},
	) {
		super.setCustomId(
			this.#embedRouter.encodePath(path, { method, queryParams }),
		);
		return this;
	}
}
