import {
	APIRoleSelectComponent,
	RoleSelectMenuBuilder,
	RoleSelectMenuComponentData,
} from "discord.js";
import { EmbedRouter } from "../EmbedRouter";
import { Path } from "path-to-regexp";
import { encodePath } from "../helpers/encodePath";

export class RouteRoleSelectMenuBuilder<
	L,
	P extends Path,
> extends RoleSelectMenuBuilder {
	private embedRouter: EmbedRouter<L>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param path the path to redirect to, :roleId in path will be replaced with the selected user's id
	 * @param query any query parameters you want to add, :roleId will be replaced with the selected user's id
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<L>,
		path: P,
		query?: ConstructorParameters<typeof URLSearchParams>[0],
		data?: Partial<RoleSelectMenuComponentData | APIRoleSelectComponent>,
	) {
		super(data);

		this.embedRouter = embedRouter;

		super.setCustomId(encodePath(this.embedRouter.getIdPrefix(), path, query));
	}

	/**
	 * Not supported for RouteRoleSelectMenuBuilder (customId set from embedRouter)
	 *
	 * @remarks
	 * @param
	 */
	override setCustomId(): this {
		throw new Error(
			"setCustomId is not supported on RouteRoleSelectMenuBuilder",
		);
	}
}
