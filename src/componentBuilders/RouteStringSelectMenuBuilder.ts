import {
	APIStringSelectComponent,
	normalizeArray,
	RestOrArray,
	StringSelectMenuBuilder,
	StringSelectMenuComponentData,
} from "discord.js";
import { Path } from "path-to-regexp";
import { RouteStringSelectMenuOptionBuilder } from "./RouteStringMenuOptionBuilder";
import { EmbedRouter } from "../EmbedRouter";
import { encodePath } from "../helpers/encodePath";
import { Method } from "../types/routes";

export class RouteStringSelectMenuBuilder<
	L,
	P extends Path,
> extends StringSelectMenuBuilder {
	#embedRouter: EmbedRouter<L>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param path the path to redirect to, :to or *to in path will be replaced with the selected user's id
	 * @param query any query parameters you want to add, :to will be replaced with the selected user's id
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<L>,
		data?:
			| Partial<StringSelectMenuComponentData | APIStringSelectComponent>
			| undefined,
	) {
		super(data);

		this.#embedRouter = embedRouter;

		super.setCustomId(
			encodePath({
				idPrefix: this.#embedRouter.getIdPrefix(),
				method: "GET",
				path: "/*to",
			}),
		);
	}

	/**
	 * Not supported for RouteStringSelectMenuBuilder (customId set from embedRouter)
	 *
	 * @remarks
	 * @param
	 */
	override setCustomId(): this {
		throw new Error(
			"setCustomId is not supported on RouteStringSelectMenuBuilder",
		);
	}

	/**
	 * Not supported for RouteStringSelectMenuBuilder (use addTos)
	 *
	 * @remarks
	 * @param
	 */
	override addOptions(): this {
		throw new Error(
			"addOptions is not supported on RouteStringSelectMenuBuilder",
		);
	}

	/**
	 * Not supported for RouteStringSelectMenuBuilder (use setTos)
	 *
	 * @remarks
	 * @param
	 */
	override setOptions(): this {
		throw new Error(
			"setOptions is not supported on RouteStringSelectMenuBuilder",
		);
	}

	/**
	 * Adds route select menu options to builder
	 *
	 * @param tos the list of route select menu options
	 */
	public addTos(
		...tos: RestOrArray<
			| RouteStringSelectMenuOptionBuilder
			| ConstructorParameters<typeof RouteStringSelectMenuOptionBuilder>[0]
		>
	): this {
		const resolved = normalizeArray(tos);
		super.addOptions(
			resolved.map((o) =>
				o instanceof RouteStringSelectMenuOptionBuilder
					? o
					: new RouteStringSelectMenuOptionBuilder(o),
			),
		);
		return this;
	}

	/**
	 * Sets route select menu options to builder
	 *
	 * @param tos the list of route select menu options
	 */
	public setTos(
		...tos: RestOrArray<
			| RouteStringSelectMenuOptionBuilder
			| ConstructorParameters<typeof RouteStringSelectMenuOptionBuilder>[0]
		>
	): this {
		const resolved = normalizeArray(tos);
		super.setOptions(
			resolved.map((o) =>
				o instanceof RouteStringSelectMenuOptionBuilder
					? o
					: new RouteStringSelectMenuOptionBuilder(o),
			),
		);
		return this;
	}

	/**
	 * Sets the pattern to redirect to (Optional)
	 *
	 * @param path the path to redirect to, :to or *to in path will be replaced with the selected user's id
	 * @param query any query parameters you want to add, :to will be replaced with the selected user's id
	 * @param method method to send to route
	 */
	public setPattern({
		path,
		query,
		method = "GET",
	}: {
		method: Method;
		path: P;
		query?: ConstructorParameters<typeof URLSearchParams>[0] | undefined;
	}): this {
		super.setCustomId(
			encodePath({
				idPrefix: this.#embedRouter.getIdPrefix(),
				method,
				path,
				query,
			}),
		);

		return this;
	}
}
