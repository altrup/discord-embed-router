import { APIButtonComponent, ButtonBuilder } from "discord.js";
import { Path } from "path-to-regexp";
import { BASE_URL } from "../consts";
import { pathToString } from "../helpers/pathToString";
import { EmbedRouter } from "../EmbedRouter";

export class RouteButtonBuilder<L> extends ButtonBuilder {
	private embedRouter: EmbedRouter<L>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 */
	constructor(
		embedRouter: EmbedRouter<L>,
		data?: Omit<Partial<APIButtonComponent>, "custom_id" | "url">,
	) {
		super(data);

		this.embedRouter = embedRouter;
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
	setTo<P extends Path>(
		path: P,
		query?: ConstructorParameters<typeof URLSearchParams>[0],
	): this {
		const idPrefix = this.embedRouter.getIdPrefix();

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
