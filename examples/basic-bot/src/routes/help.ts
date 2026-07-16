import { RouteButtonBuilder, RouteHandler } from "discord-embed-router";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} from "discord.js";

import type { Globals, Locals, Session } from "@routes/types";

export const help: RouteHandler<"GET", Globals, Session, Locals> = (
	embedRouter,
	interaction,
	{ globals },
) => {
	return {
		embeds: [
			new EmbedBuilder()
				.setColor("#b574c5")
				.setTitle("Getting Started")
				.setDescription("The example bot for discord-embed-router")
				.addFields(
					{
						name: "Catalog",
						value: `Use </catalog:${globals?.commandIds.get("catalog")}> to browse the demo pages`,
					},
					{
						name: "Suggest",
						value: `Use </suggest:${globals?.commandIds.get("suggest")}> to try a command-launched modal`,
					},
				),
		],
		components: [
			new ActionRowBuilder()
				.addComponents(
					new RouteButtonBuilder(embedRouter)
						.setLabel("Catalog")
						.setStyle(ButtonStyle.Primary)
						.setTo("/catalog"),
				)
				.addComponents(
					new ButtonBuilder()
						.setLabel("Github")
						.setStyle(ButtonStyle.Link)
						.setURL("https://github.com/altrup/discord-embed-router"),
				)
				.toJSON(),
		],
	};
};
