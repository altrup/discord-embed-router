import {
	SelectMenuComponentOptionData,
	StringSelectMenuOptionBuilder,
} from "discord.js";
import { Path } from "path-to-regexp";

import { rejectKeys } from "@componentBuilders/rejectKeys";
import { isMethod } from "@helpers/isMethod";
import type { EmbedRouter } from "@routing/EmbedRouter";
import { RouteOptions } from "@routing/types";
import { ConfigError } from "@src/ConfigError";

// path params this builder embeds into paths handed to encodePath
export const ROUTE_STRING_SELECT_MENU_OPTION_BUILDER_PARAMS = [":ts"] as const;

export class RouteStringSelectMenuOptionBuilder<
	Globals = unknown,
	Session = unknown,
	Locals = unknown,
	P extends Path = Path,
> extends StringSelectMenuOptionBuilder {
	#embedRouter: EmbedRouter<Globals, Session, Locals>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param path the path to redirect to, :to or *to in path will be replaced with the selected user's id
	 * @param queryParams any query parameters you want to add, :to will be replaced with the selected user's id
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<Globals, Session, Locals>,
		data?: Omit<SelectMenuComponentOptionData, "value" | "label"> & {
			label: string;
			to: P;
			toOptions?: RouteOptions<true, true> | undefined;
		},
	) {
		const { to, toOptions, label, ...rest } = data ?? {};
		rejectKeys(rest, ["value"], "RouteStringSelectMenuOptionBuilder");
		super({ ...rest, value: "", label: label ?? "" });

		this.#embedRouter = embedRouter;
		if (to) this.setTo(to, toOptions);
	}
	/**
	 * Not supported for RouteStringSelectMenuOptionBuilder (use setTo)
	 *
	 * @param
	 */
	override setValue(): this {
		throw new ConfigError(
			"setValue is not supported on RouteStringSelectMenuOptionBuilder",
		);
	}

	/**
	 * Sets the path to route to when selected
	 *
	 * @param path the path to route to, can include :ts
	 * @param queryParams any query parameters you want to add, can include :ts
	 * @param method method to send to route; defaults to empty, which defers
	 * to whatever method the containing RouteStringSelectMenuBuilder's pattern
	 * encodes. Set this to override the method for just this option.
	 */
	public setTo(
		path: P,
		{ method = "", queryParams }: RouteOptions<true, true> = {},
	): this {
		// only reachable by a JS caller (or an `as any`) bypassing the type
		if (!isMethod(method, { allowModal: true, allowEmpty: true }))
			throw new ConfigError(
				`Invalid method "${method}" for RouteStringSelectMenuOptionBuilder`,
			);
		super.setValue(
			this.#embedRouter.encodePath<true, true>(path, {
				idPrefix: "",
				method: method,
				queryParams,
			}),
		);

		return this;
	}
}
