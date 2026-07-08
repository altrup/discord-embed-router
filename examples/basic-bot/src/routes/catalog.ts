import { join } from "node:path";

import type { Globals, Locals, Session } from "@routes/types";
import {
	RouteHandler,
	RouteStringSelectMenuBuilder,
	RouteStringSelectMenuOptionBuilder,
} from "discord-embed-router";
import { ActionRowBuilder, EmbedBuilder } from "discord.js";

export const catalog: RouteHandler<"GET", Globals, Session, Locals> = (
	embedRouter,
	interaction,
	state,
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
					new RouteStringSelectMenuBuilder(embedRouter)
						.setPlaceholder("Choose a page")
						.setTos(
							new RouteStringSelectMenuOptionBuilder(embedRouter)
								.setLabel("Counter")
								.setDescription("A simple counter page")
								.setTo(join(state.path, "counter")),
							new RouteStringSelectMenuOptionBuilder(embedRouter)
								.setLabel("User Info")
								.setDescription("View someone's user info")
								.setTo(join(state.path, "user-info")),
							new RouteStringSelectMenuOptionBuilder(embedRouter)
								.setLabel("Timer")
								.setDescription("A sample timer page")
								.setTo(join(state.path, "timer")),
						),
				)
				.toJSON(),
		],
	};
};
