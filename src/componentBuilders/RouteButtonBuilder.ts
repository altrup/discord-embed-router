import { APIButtonComponent, ButtonBuilder } from "discord.js";
import { Path } from "path-to-regexp";
import { EmbedRouter } from "../EmbedRouter";
import { encodePath } from "../helpers/encodePath";
import { RouteOptions } from "../types/componentBuilders";

export class RouteButtonBuilder<L> extends ButtonBuilder {
	#embedRouter: EmbedRouter<L>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<L>,
		data?: Omit<Partial<APIButtonComponent>, "custom_id" | "url"> | undefined,
	) {
		super(data);

		this.#embedRouter = embedRouter;
	}

	/**
	 * Not supported for RouteButtonBuilder
	 *
	 * @param
	 */
	override setURL(): this {
		throw new Error("setURL is not supported on RouteButtonBuilder");
	}

	/**
	 * Not supported for RouteButtonBuilder (use setTo)
	 *
	 * @param
	 */
	override setCustomId(): this {
		throw new Error("setCustomId is not supported on RouteButtonBuilder");
	}

	/**
	 * Sets the path to route to when clicked
	 *
	 * @param path the path to route to, can include :ts
	 * @param query any query parameters you want to add, can include :ts
	 * @param method method to send to route
	 */
	public setTo<P extends Path>(
		path: P,
		{ method = "GET", query }: RouteOptions = {},
	): this {
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
