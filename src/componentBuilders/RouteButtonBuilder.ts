import { APIButtonComponent, ButtonBuilder } from "discord.js";
import { Path } from "path-to-regexp";
import { EmbedRouter } from "../EmbedRouter";
import { encodePath } from "../helpers/encodePath";

export class RouteButtonBuilder<L> extends ButtonBuilder {
	#embedRouter: EmbedRouter<L>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<L>,
		data?: Omit<Partial<APIButtonComponent>, "custom_id" | "url">,
	) {
		super(data);

		this.#embedRouter = embedRouter;
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
	 * Not supported for RouteButtonBuilder (use setTo)
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
	 * @param query any query parameters you want to add
	 */
	public setTo<P extends Path>(
		path: P,
		query?: ConstructorParameters<typeof URLSearchParams>[0],
	): this {
		super.setCustomId(encodePath(this.#embedRouter.getIdPrefix(), path, query));

		return this;
	}
}
