import { RoleSelectMenuBuilder } from "discord.js";
import { Path } from "path-to-regexp";

import { rejectKeys } from "@componentBuilders/rejectKeys";
import { isMethod } from "@helpers/isMethod";
import type { DistributiveOmit } from "@helpers/types";
import type { EmbedRouter } from "@routing/EmbedRouter";
import { RouteOptions } from "@routing/types";
import { ConfigError } from "@src/ConfigError";

// path params this builder embeds into paths handed to encodePath
export const ROUTE_ROLE_SELECT_MENU_BUILDER_PARAMS = [
	":ts",
	":roleId",
	"*roleIds",
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
	 * @param path the path to redirect to, can include :ts :roleId *roleIds
	 * @param query any query parameters you want to add, can include :ts :roleId *roleIds
	 * @param method method to send to route
	 */
	public setPattern(path: P, { method = "GET", query }: RouteOptions = {}) {
		// only reachable by a JS caller (or an `as any`) bypassing the type
		if (!isMethod(method))
			throw new ConfigError(
				`Invalid method "${method}" for RouteRoleSelectMenuBuilder`,
			);
		super.setCustomId(
			this.#embedRouter.encodePath(path, {
				method,
				query,
			}),
		);

		return this;
	}
}
