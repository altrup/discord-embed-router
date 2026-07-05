import {
	APIUserSelectComponent,
	UserSelectMenuBuilder,
	UserSelectMenuComponentData,
} from "discord.js";
import { EmbedRouter } from "../EmbedRouter";
import { Path } from "path-to-regexp";
import { encodePath } from "../helpers/encodePath";
import { isSetOptions, SetOptions } from "../types/componentBuilders";

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
	 * @remarks
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
	 * @param path the path to redirect to, :userId in path will be replaced with the selected user's id
	 * @param query any query parameters you want to add, :userId will be replaced with the selected user's id
	 * @param method method to send to route
	 */
	public setPattern<P extends Path>({
		method,
		path,
		query,
	}: SetOptions<P>): this;
	/**
	 * Sets the path to route to when clicked
	 *
	 * @param path the path to route to
	 */
	public setPattern<P extends Path>(path: P): this;

	public setPattern<P extends Path>(arg: P | SetOptions<P>) {
		const {
			method = "GET",
			path,
			query,
		} = isSetOptions(arg) ? arg : { path: arg };
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
