import { RoleSelectMenuBuilder } from "discord.js";
import { EmbedRouter } from "../routing/EmbedRouter";
import { Path } from "path-to-regexp";
import { RouteOptions } from "../routing/types";

export class RouteRoleSelectMenuBuilder<
	L extends object,
	P extends Path = Path,
> extends RoleSelectMenuBuilder {
	#embedRouter: EmbedRouter<L>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<L>,
		data?: Omit<
			ConstructorParameters<typeof RoleSelectMenuBuilder>[0],
			"customId"
		> & {
			pattern?: P | undefined;
			patternOptions?: RouteOptions | undefined;
		},
	) {
		const { pattern, patternOptions, ...rest } = data ?? {};
		super(rest);

		this.#embedRouter = embedRouter;
		if (pattern) this.setPattern(pattern, patternOptions);
	}

	/**
	 * Not supported for RouteRoleSelectMenuBuilder (customId set from embedRouter)
	 *
	 * @param
	 */
	override setCustomId(): this {
		throw new Error(
			"setCustomId is not supported on RouteRoleSelectMenuBuilder",
		);
	}

	/**
	 * Sets the pattern to redirect to (Required)
	 *
	 * @param path the path to redirect to, can include :ts :roleId *roleIds
	 * @param query any query parameters you want to add, can include :ts :roleId *roleIds
	 * @param method method to send to route
	 */
	public setPattern(path: P, { method = "GET", query }: RouteOptions = {}) {
		super.setCustomId(
			this.#embedRouter.encodePath(path, {
				method,
				query,
			}),
		);

		return this;
	}
}
