import {
	APIUserSelectComponent,
	UserSelectMenuBuilder,
	UserSelectMenuComponentData,
} from "discord.js";
import { EmbedRouter } from "../EmbedRouter";
import { Path } from "path-to-regexp";
import { encodePath } from "../helpers/encodePath";
import { RouteOptions } from "../types/componentBuilders";

export class RouteUserSelectMenuBuilder<L> extends UserSelectMenuBuilder {
	#embedRouter: EmbedRouter<L>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<L>,
		data?:
			Partial<UserSelectMenuComponentData | APIUserSelectComponent> | undefined,
	) {
		super(data);

		this.#embedRouter = embedRouter;
	}

	/**
	 * Not supported for RouteUserSelectMenuBuilder (customId set from embedRouter)
	 *
	 * @param
	 */
	override setCustomId(): this {
		throw new Error(
			"setCustomId is not supported on RouteUserSelectMenuBuilder",
		);
	}

	/**
	 * Sets the pattern to redirect to (Required)
	 *
	 * @param path the path to redirect to, can include :ts :userId
	 * @param query any query parameters you want to add, can include :ts :userId
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
