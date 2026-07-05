import {
	APIUserSelectComponent,
	UserSelectMenuBuilder,
	UserSelectMenuComponentData,
} from "discord.js";
import { EmbedRouter } from "../EmbedRouter";
import { Path } from "path-to-regexp";
import { encodePath } from "../helpers/encodePath";
import { Method } from "../types/routes";

export class RouteUserSelectMenuBuilder<
	L,
	P extends Path,
> extends UserSelectMenuBuilder {
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
	public setPattern({
		path,
		query,
		method = "GET",
	}: {
		method: Method;
		path: P;
		query?: ConstructorParameters<typeof URLSearchParams>[0] | undefined;
	}): this {
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
