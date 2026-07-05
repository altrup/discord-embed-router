import {
	APIStringSelectComponent,
	normalizeArray,
	RestOrArray,
	StringSelectMenuBuilder,
	StringSelectMenuComponentData,
} from "discord.js";
import { RouteSelectMenuOptionBuilder } from "./RouteSelectMenuOptionBuilder";
import { EmbedRouter } from "../EmbedRouter";

export class RouteSelectMenuBuilder<L> extends StringSelectMenuBuilder {
	private embedRouter: EmbedRouter<L>;

	/**
	 *
	 * @param embedRouter the router you want to route with
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
	 * Not supported for RouteButtonBuilder (use addTos)
	 *
	 * @remarks
	 * @param
	 */
	override addOptions(): this {
		throw new Error("setCustomId is not supported on RouteButtonBuilder");
	}

	/**
	 * Adds route select menu options to builder
	 *
	 * @param tos the list of route select menu options
	 */
	public addTos(
		...tos: RestOrArray<
			| RouteSelectMenuOptionBuilder
			| ConstructorParameters<typeof RouteSelectMenuOptionBuilder>[0]
		>
	): this {
		const resolved = normalizeArray(tos);
		super.addOptions(
			resolved.map((o) =>
				o instanceof RouteSelectMenuOptionBuilder
					? o
					: new RouteSelectMenuOptionBuilder(o),
			),
		);
		return this;
	}
}
