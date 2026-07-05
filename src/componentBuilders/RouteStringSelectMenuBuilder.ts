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
		throw new Error("setCustomId is not supported on RouteStringSelectMenuBuilder");
	}

	/**
	 * Not supported for RouteStringSelectMenuBuilder (use addTos)
	 *
	 * @remarks
	 * @param
	 */
	override addOptions(): this {
		throw new Error("setCustomId is not supported on RouteStringSelectMenuBuilder");
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
}
