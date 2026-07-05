import {
	APIUserSelectComponent,
	UserSelectMenuBuilder,
	UserSelectMenuComponentData,
} from "discord.js";
import { EmbedRouter } from "../EmbedRouter";
import { Path } from "path-to-regexp";
import { pathToString } from "../helpers/pathToString";
import { BASE_URL } from "../consts";

export class RouteUserSelectMenuBuilder<
	L,
	P extends Path,
> extends UserSelectMenuBuilder {
	private embedRouter: EmbedRouter<L>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param path the path to redirect to, :userId in path will be replaced with the selected user's id
	 * @param query any query parameters you want to add, :userId will be replaced with the selected user's id
	 */
	constructor(
		embedRouter: EmbedRouter<L>,
		path: P,
		query: URLSearchParams,
		data?: Partial<UserSelectMenuComponentData | APIUserSelectComponent>,
	) {
		super(data);

		this.embedRouter = embedRouter;

		const idPrefix = this.embedRouter.getIdPrefix();
		const url = new URL(pathToString(path), BASE_URL);
		if (query) {
			for (const [key, value] of new URLSearchParams(query)) {
				url.searchParams.set(key, value);
			}
		}
		const customId = `${idPrefix}${url.pathname}${url.search}`;
		super.setCustomId(customId);
	}

	/**
	 * Not supported for RouteStringSelectMenuBuilder (customId set from embedRouter)
	 *
	 * @remarks
	 * @param
	 */
	override setCustomId(): this {
		throw new Error(
			"setCustomId is not supported on RouteStringSelectMenuBuilder",
		);
	}
}
