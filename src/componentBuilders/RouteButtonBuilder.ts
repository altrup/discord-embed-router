import { ButtonBuilder } from "discord.js";
import { Path } from "path-to-regexp";

import { rejectKeys } from "@componentBuilders/rejectKeys";
import type { DistributiveOmit } from "@helpers/types";
import type { EmbedRouter } from "@routing/EmbedRouter";
import { ComponentKeyOption, RouteOptions } from "@routing/types";
import { ConfigError } from "@src/ConfigError";

// path params this builder embeds into paths handed to encodePath
export const ROUTE_BUTTON_BUILDER_PARAMS = [":ts"] as const;

export class RouteButtonBuilder<
	Globals = unknown,
	Session = unknown,
	Locals = unknown,
	P extends Path = Path,
> extends ButtonBuilder {
	#embedRouter: EmbedRouter<Globals, Session, Locals>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<Globals, Session, Locals>,
		data?: DistributiveOmit<
			NonNullable<ConstructorParameters<typeof ButtonBuilder>[0]>,
			"custom_id" | "customId" | "url"
		> & {
			to?: P | undefined;
			toOptions?: (RouteOptions<true> & ComponentKeyOption) | undefined;
		},
	) {
		const { to, toOptions, ...rest } = data ?? {};
		rejectKeys(rest, ["custom_id", "customId", "url"], "RouteButtonBuilder");
		super(rest);

		this.#embedRouter = embedRouter;
		if (to) this.setTo(to, toOptions);
	}

	/**
	 * Not supported for RouteButtonBuilder
	 *
	 * @param
	 */
	override setURL(): this {
		throw new ConfigError("setURL is not supported on RouteButtonBuilder");
	}

	/**
	 * Not supported for RouteButtonBuilder (use setTo)
	 *
	 * @param
	 */
	override setCustomId(): this {
		throw new ConfigError("setCustomId is not supported on RouteButtonBuilder");
	}

	/**
	 * Sets the path to route to when clicked
	 *
	 * @param path the path to route to, can include :ts
	 * @param queryParams any query parameters you want to add, can include :ts
	 * @param method method to send to route
	 * @param key disambiguates components that would otherwise get identical
	 * customIds, which Discord rejects within one message
	 */
	public setTo(
		path: P,
		{
			method = "GET",
			queryParams,
			key,
		}: RouteOptions<true> & ComponentKeyOption = {},
	): this {
		super.setCustomId(
			this.#embedRouter.encodePath(path, { method, queryParams, key }),
		);
		return this;
	}
}
