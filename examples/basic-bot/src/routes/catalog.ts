import { ActionRowBuilder, EmbedBuilder, Interaction } from "discord.js";
import {
	RouteStringSelectMenuBuilder,
	RouteStringSelectMenuOptionBuilder,
	State,
} from "discord-embed-router";
import type { Locals } from "@routes/types";

export const catalog = (interaction: Interaction, state: State<Locals>) => {
	return {
		embeds: [
			new EmbedBuilder()
				.setColor("#7a74c5")
				.setTitle("Catalog")
				.setDescription(`All pages in this bot`)
				.addFields({
					name: "Counter",
					value: "A simple counter page",
				}),
		],
		components: [
			new ActionRowBuilder()
				.addComponents(
					new RouteStringSelectMenuBuilder(state.embedRouter)
						.setPlaceholder("Choose a page")
						.setTos(
							new RouteStringSelectMenuOptionBuilder()
								.setLabel("Counter")
								.setTo("/catalog/counter"),
						),
				)
				.toJSON(),
		],
	};
};
