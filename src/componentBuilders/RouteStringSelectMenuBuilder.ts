import {
	APIStringSelectComponent,
	normalizeArray,
	RestOrArray,
	StringSelectMenuBuilder,
	StringSelectMenuComponentData,
} from "discord.js";
import { RouteStringSelectMenuOptionBuilder } from "./RouteStringMenuOptionBuilder";
import { EmbedRouter } from "../EmbedRouter";

export class RouteStringSelectMenuBuilder<L> extends StringSelectMenuBuilder {
	private embedRouter: EmbedRouter<L>;

	/**
	 *
	 * @param embedRouter the router you want to route with
	 * @param data the data to construct a component out of
	 */
	constructor(
		embedRouter: EmbedRouter<L>,
		data?: Partial<StringSelectMenuComponentData | APIStringSelectComponent>,
	) {
		super(data);

		this.embedRouter = embedRouter;
		super.setCustomId(this.embedRouter.getIdPrefix());
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
}
