import { RoleSelectMenuBuilder } from "discord.js";
import { Path } from "path-to-regexp";

import { encodeRouteCustomId } from "@componentBuilders/encodeRouteCustomId";
import { rejectKeys } from "@componentBuilders/rejectKeys";
import type { DistributiveOmit } from "@helpers/types";
import type { EmbedRouter } from "@routing/EmbedRouter";
import { RouteOptions } from "@routing/types";
import { ConfigError } from "@src/ConfigError";

// path params this builder embeds into paths handed to encodePath
export const ROUTE_ROLE_SELECT_MENU_BUILDER_PARAMS = [
	":ts",
	":roleId",
] as const;

export class RouteRoleSelectMenuBuilder<
	Globals = unknown,
	Session = unknown,
	Locals = unknown,
	P extends Path = Path,
> extends RoleSelectMenuBuilder {
	#embedRouter: EmbedRouter<Globals, Session, Locals>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<Globals, Session, Locals>,
		data?: DistributiveOmit<
			NonNullable<ConstructorParameters<typeof RoleSelectMenuBuilder>[0]>,
			"customId" | "custom_id"
		> & {
			pattern?: P | undefined;
			patternOptions?: RouteOptions | undefined;
		},
	) {
		const { pattern, patternOptions, ...rest } = data ?? {};
		rejectKeys(rest, ["custom_id", "customId"], "RouteRoleSelectMenuBuilder");
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
		throw new ConfigError(
			"setCustomId is not supported on RouteRoleSelectMenuBuilder",
		);
	}

	/**
	 * Sets the pattern to redirect to (Required)
	 *
	 * @param path the path to redirect to, can include :ts :roleId
	 * @param queryParams any query parameters you want to add, can include :ts :roleId
	 * @param method method to send to route
	 */
	public setPattern(path: P, { method = "GET", queryParams }: RouteOptions = {}) {
		super.setCustomId(
			encodeRouteCustomId(
				this.#embedRouter,
				"RouteRoleSelectMenuBuilder",
				path,
				method,
				queryParams,
			),
		);
		return this;
	}
}
