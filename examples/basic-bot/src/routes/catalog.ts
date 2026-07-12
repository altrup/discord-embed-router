import { join } from "node:path";

import {
	RouteHandler,
	RouteStringSelectMenuBuilder,
	RouteStringSelectMenuOptionBuilder,
} from "discord-embed-router";
import { ActionRowBuilder, EmbedBuilder } from "discord.js";

import type { Globals, Locals, Session } from "@routes/types";

export const catalog: RouteHandler<"GET", Globals, Session, Locals> = (
	embedRouter,
	interaction,
	{ path },
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
								.setTo(join(path, "counter")),
							new RouteStringSelectMenuOptionBuilder(embedRouter)
								.setLabel("User Info")
								.setDescription("View someone's user info")
								.setTo(join(path, "user-info")),
							new RouteStringSelectMenuOptionBuilder(embedRouter)
								.setLabel("Profile")
								.setDescription("Persistent per-user data through locals")
								.setTo(join(path, "profile")),
							new RouteStringSelectMenuOptionBuilder(embedRouter)
								.setLabel("Timer")
								.setDescription("A sample timer page")
								.setTo(join(path, "timer")),
							new RouteStringSelectMenuOptionBuilder(embedRouter)
								.setLabel("Tic-Tac-Toe")
								.setDescription("Play tic-tac-toe against the computer")
								.setTo(join(path, "tic-tac-toe")),
						),
				)
				.toJSON(),
		],
	};
};
