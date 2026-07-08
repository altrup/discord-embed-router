import {
	normalizeArray,
	RestOrArray,
	StringSelectMenuBuilder,
	StringSelectMenuComponentData,
} from "discord.js";
import { Path } from "path-to-regexp";
import { RouteStringSelectMenuOptionBuilder } from "@componentBuilders/RouteStringSelectMenuOptionBuilder";
import { EmbedRouter } from "@routing/EmbedRouter";
import { RouteOptions } from "@routing/types";
export class RouteStringSelectMenuBuilder<
	Globals = unknown,
	Session = unknown,
	Locals = unknown,
	P extends Path = Path,
> extends StringSelectMenuBuilder {
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
		data?: Omit<StringSelectMenuComponentData, "customId" | "options"> & {
			pattern?: P | undefined;
			patternOptions?: RouteOptions | undefined;
			tos: readonly RouteStringSelectMenuOptionBuilder<
				Globals,
				Session,
				Locals,
				P
			>[];
		},
	) {
		const { pattern, patternOptions, tos, ...rest } = data ?? {};
		super(rest);

		this.#embedRouter = embedRouter;

		if (pattern) {
			this.setPattern(pattern, patternOptions);
		} else {
			super.setCustomId(
				this.#embedRouter.encodePath("/*to", {
					method: "GET",
				}),
			);
		}

		if (tos) this.setTos(...tos);
	}

	/**
	 * Not supported for RouteStringSelectMenuBuilder (customId set from embedRouter)
	 *
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
			| RouteStringSelectMenuOptionBuilder<Globals, Session, Locals, P>
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
			| RouteStringSelectMenuOptionBuilder<Globals, Session, Locals>
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
	 * Sets the pattern to redirect to (Required)
	 *
	 * @param path the path to redirect to, can include :ts *to *tos
	 * @param query any query parameters you want to add, can include :ts *to *tos
	 * @param method method to send to route
	 */
	public setPattern(path: P, { method = "GET", query }: RouteOptions = {}) {
		super.setCustomId(
			this.#embedRouter.encodePath(path, {
				method,
				query,
			}),
		);

		return this;
	}
}
