import type { Globals, Locals, Session } from "@routes/types";
import { RouteButtonBuilder, RouteHandler } from "discord-embed-router";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} from "discord.js";

export const help: RouteHandler<"GET", Globals, Session, Locals> = (
	embedRouter,
	interaction,
	state,
) => {
	return {
		embeds: [
			new EmbedBuilder()
				.setColor("#b574c5")
				.setTitle("Getting Started")
				.setDescription("The example bot for discord-embed-builder")
				.addFields({
					name: "Counter",
					value: `Use </catalog:${state.globals?.commandIds.get("catalog")}> to view a list of all commands`,
				}),
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
