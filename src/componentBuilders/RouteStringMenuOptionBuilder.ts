import {
	APISelectMenuOption,
	SelectMenuComponentOptionData,
	StringSelectMenuOptionBuilder,
} from "discord.js";
import { Path } from "path-to-regexp";
import { encodePath } from "../helpers/encodePath";

export class RouteStringSelectMenuOptionBuilder extends StringSelectMenuOptionBuilder {
	/**
	 *
	 * @param data the data to construct a component out of
	 */
	constructor(
		data?: Omit<
			SelectMenuComponentOptionData | APISelectMenuOption,
			"value"
		> & { to: string },
	) {
		const stringSelectData = data
			? {
					...data,
					value: encodePath("", data.to),
				}
			: undefined;
		super(stringSelectData);
	}

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
	 */
	public setTo<P extends Path>(
		path: P,
		query?: ConstructorParameters<typeof URLSearchParams>[0],
	): this {
		super.setValue(encodePath("", path, query));

		return this;
	}
}
