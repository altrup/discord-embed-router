import { ButtonBuilder } from "discord.js";
import { Path } from "path-to-regexp";

import { EmbedRouter } from "@routing/EmbedRouter";
import { RouteOptions } from "@routing/types";

export class RouteButtonBuilder<
	Globals = unknown,
	Session = unknown,
	Locals = unknown,
	P extends Path = Path,
> extends ButtonBuilder {
	#embedRouter: EmbedRouter<Globals, Session, Locals>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<Globals, Session, Locals>,
		data?: Omit<
			ConstructorParameters<typeof ButtonBuilder>[0],
			"custom_id" | "url"
		> & {
			to?: P | undefined;
			toOptions?: RouteOptions | undefined;
		},
	) {
		const { to, toOptions, ...rest } = data ?? {};
		super(rest);

		this.#embedRouter = embedRouter;
		if (to) this.setTo(to, toOptions);
	}

	/**
	 * Not supported for RouteButtonBuilder
	 *
	 * @param
	 */
	override setURL(): this {
		throw new Error("setURL is not supported on RouteButtonBuilder");
	}

	/**
	 * Not supported for RouteButtonBuilder (use setTo)
	 *
	 * @param
	 */
	override setCustomId(): this {
		throw new Error("setCustomId is not supported on RouteButtonBuilder");
	}

	/**
	 * Sets the path to route to when clicked
	 *
	 * @param path the path to route to, can include :ts
	 * @param query any query parameters you want to add, can include :ts
	 * @param method method to send to route
	 */
	public setTo(path: P, { method = "GET", query }: RouteOptions = {}): this {
		super.setCustomId(
			this.#embedRouter.encodePath(path, {
				method,
				query,
			}),
		);

		return this;
	}
}
