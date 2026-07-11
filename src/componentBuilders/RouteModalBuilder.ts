import { ModalBuilder } from "discord.js";
import { Path } from "path-to-regexp";

import { rejectKeys } from "@componentBuilders/rejectKeys";
import { isMethod } from "@helpers/isMethod";
import type { DistributiveOmit } from "@helpers/types";
import type { EmbedRouter } from "@routing/EmbedRouter";
import { RouteOptionsWithMethod } from "@routing/types";
import { ConfigError } from "@src/ConfigError";

// path params this builder embeds into paths handed to encodePath
export const ROUTE_MODAL_BUILDER_PARAMS = [":ts"] as const;

export class RouteModalBuilder<
	Globals = unknown,
	Session = unknown,
	Locals = unknown,
	P extends Path = Path,
> extends ModalBuilder {
	#embedRouter: EmbedRouter<Globals, Session, Locals>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param data the data to construct a modal out of
	 */
	constructor(
		embedRouter: EmbedRouter<Globals, Session, Locals>,
		data?: DistributiveOmit<
			NonNullable<ConstructorParameters<typeof ModalBuilder>[0]>,
			"custom_id" | "customId"
		> & {
			to?: P | undefined;
			toOptions?: RouteOptionsWithMethod | undefined;
		},
	) {
		const { to, toOptions, ...rest } = data ?? {};
		rejectKeys(rest, ["custom_id", "customId"], "RouteModalBuilder");
		super(rest);

		this.#embedRouter = embedRouter;
		if (to && !toOptions)
			throw new ConfigError("toOptions is required when to is set for RouteModalBuilder");
		if (to) this.setTo(to, toOptions!);
	}

	/**
	 * Not supported for RouteModalBuilder (use setTo)
	 *
	 * @param
	 */
	override setCustomId(): this {
		throw new ConfigError(
			"setCustomId is not supported on RouteModalBuilder; use setTo",
		);
	}

	/**
	 * Sets the path the modal's submission routes to
	 *
	 * @param path the path to route to, can include :ts
	 * @param method method to send to route; required because a submission's
	 * target is wherever it gets processed, so there's no sane default
	 * @param query any query parameters you want to add, can include :ts
	 */
	public setTo(path: P, { method, query }: RouteOptionsWithMethod): this {
		// only reachable by a JS caller (or an `as any`) bypassing the type
		if (!isMethod(method))
			throw new ConfigError(`Invalid method "${method}" for RouteModalBuilder`);
		super.setCustomId(
			this.#embedRouter.encodePath(path, {
				method,
				query,
			}),
		);

		return this;
	}
}
