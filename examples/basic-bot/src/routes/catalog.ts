import { join } from "node:path";
import { ActionRowBuilder, EmbedBuilder, Interaction } from "discord.js";
import {
	RouteHandler,
	RouteStringSelectMenuBuilder,
	RouteStringSelectMenuOptionBuilder,
	State,
} from "discord-embed-router";
import type { Locals } from "@routes/types";

export const catalog: RouteHandler<"GET", Locals> = (
	interaction: Interaction,
	state: State<Locals>,
) => {
	return {
		embeds: [
			new EmbedBuilder()
				.setColor("#7a74c5")
				.setTitle("Catalog")
				.setDescription(`All pages in this bot`),
		],
		components: [
			new ActionRowBuilder()
				.addComponents(
					new RouteStringSelectMenuBuilder(state.embedRouter)
						.setPlaceholder("Choose a page")
						.setTos(
							new RouteStringSelectMenuOptionBuilder()
								.setLabel("Counter")
								.setDescription("A simple counter page")
								.setTo(join(state.path, "counter")),
							new RouteStringSelectMenuOptionBuilder()
								.setLabel("User Info")
								.setDescription("View someone's user info")
								.setTo(join(state.path, "user-info")),
							new RouteStringSelectMenuOptionBuilder()
								.setLabel("Timer")
								.setDescription("A sample timer page")
								.setTo(join(state.path, "timer")),
						),
				)
				.toJSON(),
		],
	};
};
