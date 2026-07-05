import {
	APIChannelSelectComponent,
	ChannelSelectMenuBuilder,
	ChannelSelectMenuComponentData,
} from "discord.js";
import { EmbedRouter } from "../EmbedRouter";
import { Path } from "path-to-regexp";
import { encodePath } from "../helpers/encodePath";
import { RouteOptions } from "../types/componentBuilders";

export class RouteChannelSelectMenuBuilder<L> extends ChannelSelectMenuBuilder {
	#embedRouter: EmbedRouter<L>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<L>,
		data?:
			| Partial<ChannelSelectMenuComponentData | APIChannelSelectComponent>
			| undefined,
	) {
		super(data);

		this.#embedRouter = embedRouter;
	}

	/**
	 * Not supported for RouteChannelSelectMenuBuilder (customId set from embedRouter)
	 *
	 * @remarks
	 * @param
	 */
	override setCustomId(): this {
		throw new Error(
			"setCustomId is not supported on RouteChannelSelectMenuBuilder",
		);
	}

	/**
	 * Sets the pattern to redirect to (Required)
	 *
	 * @param path the path to redirect to, :channelId in path will be replaced with the selected user's id
	 * @param query any query parameters you want to add, :channelId will be replaced with the selected user's id
	 * @param method method to send to route
	 */
	public setPattern<P extends Path>(
		path: P,
		{ method = "GET", query }: RouteOptions = {},
	) {
		super.setCustomId(
			encodePath({
				idPrefix: this.#embedRouter.getIdPrefix(),
				method,
				path,
				query,
			}),
		);

		return this;
	}
}
