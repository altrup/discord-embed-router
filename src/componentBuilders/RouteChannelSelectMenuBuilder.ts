import { ChannelSelectMenuBuilder } from "discord.js";
import { Path } from "path-to-regexp";

import { encodeRouteCustomId } from "@componentBuilders/encodeRouteCustomId";
import { rejectKeys } from "@componentBuilders/rejectKeys";
import type { DistributiveOmit } from "@helpers/types";
import type { EmbedRouter } from "@routing/EmbedRouter";
import { RouteOptions } from "@routing/types";
import { ConfigError } from "@src/ConfigError";

// path params this builder embeds into paths handed to encodePath
export const ROUTE_CHANNEL_SELECT_MENU_BUILDER_PARAMS = [
	":ts",
	":channelId",
	"*channelIds",
] as const;

export class RouteChannelSelectMenuBuilder<
	Globals = unknown,
	Session = unknown,
	Locals = unknown,
	P extends Path = Path,
> extends ChannelSelectMenuBuilder {
	#embedRouter: EmbedRouter<Globals, Session, Locals>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<Globals, Session, Locals>,
		data?: DistributiveOmit<
			NonNullable<ConstructorParameters<typeof ChannelSelectMenuBuilder>[0]>,
			"customId" | "custom_id"
		> & {
			pattern?: P | undefined;
			patternOptions?: RouteOptions | undefined;
		},
	) {
		const { pattern, patternOptions, ...rest } = data ?? {};
		rejectKeys(
			rest,
			["custom_id", "customId"],
			"RouteChannelSelectMenuBuilder",
		);
		super(rest);

		this.#embedRouter = embedRouter;
		if (pattern) this.setPattern(pattern, patternOptions);
	}

	/**
	 * Not supported for RouteChannelSelectMenuBuilder (customId set from embedRouter)
	 *
	 * @param
	 */
	override setCustomId(): this {
		throw new ConfigError(
			"setCustomId is not supported on RouteChannelSelectMenuBuilder",
		);
	}

	/**
	 * Sets the pattern to redirect to (Required)
	 *
	 * @param path the path to redirect to, can include :ts :channelId *channelIds
	 * @param query any query parameters you want to add, can include :ts :channelId *channelIds
	 * @param method method to send to route
	 */
	public setPattern(path: P, { method = "GET", query }: RouteOptions = {}) {
		super.setCustomId(
			encodeRouteCustomId(
				this.#embedRouter,
				"RouteChannelSelectMenuBuilder",
				path,
				method,
				query,
			),
		);
		return this;
	}
}
