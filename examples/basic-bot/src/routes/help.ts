import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	Interaction,
} from "discord.js";
import { RouteButtonBuilder, State } from "discord-embed-router";
import type { Locals } from "@routes/types";

export const help = (interaction: Interaction, state: State<Locals>) => {
	return {
		embeds: [
			new EmbedBuilder()
				.setColor("#b574c5")
				.setTitle("Getting Started")
				.setDescription("The example bot for discord-embed-builder")
				.addFields({
					name: "Counter",
					value: `Use </counter:${state.locals?.commandIds.get("counter")}> to see the example counter page`,
				}),
		],
		components: [
			new ActionRowBuilder()
				.addComponents(
					new RouteButtonBuilder()
						.setLabel("Counter")
						.setStyle(ButtonStyle.Primary)
						.setTo(state.embedRouter, "/counter"),
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
