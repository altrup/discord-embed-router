import { StringSelectMenuOptionBuilder } from "discord.js";
import { Path } from "path-to-regexp";
import { encodePath } from "../helpers/encodePath";
import { Method } from "../types/routes";

export class RouteStringSelectMenuOptionBuilder extends StringSelectMenuOptionBuilder {
	/**
	 * Not supported for RouteStringSelectMenuOptionBuilder (use setTo)
	 *
	 * @remarks
	 * @param
	 */
	override setValue(): this {
		throw new Error(
			"setValue is not supported on RouteStringSelectMenuOptionBuilder",
		);
	}

	/**
	 * Sets the path to route to when clicked
	 *
	 * @param path the path to route to
	 * @param query any query parameters you want to add
	 * @param method method to send to route
	 */
	public setTo<P extends Path>({
		path,
		query,
		method = "GET",
	}: {
		path: P;
		query?: ConstructorParameters<typeof URLSearchParams>[0] | undefined;
		method: Method;
	}): this {
		super.setValue(
			encodePath({
				idPrefix: "",
				method,
				path,
				query,
			}),
		);

		return this;
	}
}
