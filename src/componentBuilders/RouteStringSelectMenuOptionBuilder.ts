import {
	SelectMenuComponentOptionData,
	StringSelectMenuOptionBuilder,
} from "discord.js";
import { Path } from "path-to-regexp";

import { EmbedRouter } from "@routing/EmbedRouter";
import { RouteOptions } from "@routing/types";

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
	 * @param query any query parameters you want to add, :to will be replaced with the selected user's id
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<Globals, Session, Locals>,
		data?: Omit<SelectMenuComponentOptionData, "value" | "label"> & {
			label: string;
			to: P;
			toOptions?: Omit<RouteOptions, "method"> | undefined;
		},
	) {
		const { to, toOptions, label, ...rest } = data ?? {};
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
		throw new Error(
			"setValue is not supported on RouteStringSelectMenuOptionBuilder",
		);
	}

	/**
	 * Sets the path to route to when selected
	 *
	 * @param path the path to route to, can include :ts
	 * @param query any query parameters you want to add, can include :ts
	 * @param method method to send to route
	 */
	public setTo(path: P, { query }: Omit<RouteOptions, "method"> = {}): this {
		super.setValue(
			this.#embedRouter.encodePath<true>(path, {
				idPrefix: "",
				method: "",
				query,
			}),
		);

		return this;
	}
}
