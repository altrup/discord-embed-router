import {
	APISelectMenuOption,
	SelectMenuComponentOptionData,
	StringSelectMenuOptionBuilder,
} from "discord.js";
import { Path } from "path-to-regexp";
import { pathToString } from "../helpers/pathToString";
import { BASE_URL } from "../consts";

export class RouteStringSelectMenuOptionBuilder extends StringSelectMenuOptionBuilder {
	// calculates the string value of a path
	private static calculateValue<P extends Path>(
		path: P,
		query?: ConstructorParameters<typeof URLSearchParams>[0],
	) {
		const url = new URL(pathToString(path), BASE_URL);
		if (query) {
			for (const [key, value] of new URLSearchParams(query)) {
				url.searchParams.set(key, value);
			}
		}
		return `${url.pathname}${url.search}`;
	}

	constructor(
		data?: Omit<
			SelectMenuComponentOptionData | APISelectMenuOption,
			"value"
		> & { to: string },
	) {
		const stringSelectData = data
			? {
					...data,
					value: RouteStringSelectMenuOptionBuilder.calculateValue(data.to),
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
	setTo<P extends Path>(
		path: P,
		query?: ConstructorParameters<typeof URLSearchParams>[0],
	): this {
		super.setValue(
			RouteStringSelectMenuOptionBuilder.calculateValue(path, query),
		);

		return this;
	}
}
