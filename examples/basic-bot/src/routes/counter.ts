import {
	ActionRowBuilder,
	ButtonStyle,
	EmbedBuilder,
	Interaction,
} from "discord.js";
import { RouteButtonBuilder, State } from "discord-embed-router";
import type { Locals } from "@routes/types";

export const counter = (interaction: Interaction, state: State<Locals>) => {
	const counterValue = parseInt(state.query.get("value") ?? "0");

	return {
		embeds: [
			new EmbedBuilder()
				.setColor("#7a74c5")
				.setTitle("Counter")
				.setDescription(`**${counterValue}**`),
		],
		components: [
			new ActionRowBuilder()
				.addComponents(
					new RouteButtonBuilder()
						.setLabel("Decrease")
						.setStyle(ButtonStyle.Danger)
						.setTo(state.embedRouter, state.path, {
							value: `${counterValue - 1}`,
						}),
				)
				.addComponents(
					new RouteButtonBuilder()
						.setLabel("Increase")
						.setStyle(ButtonStyle.Success)
						.setTo(state.embedRouter, state.path, {
							value: `${counterValue + 1}`,
						}),
				)
				.toJSON(),
		],
	};
};
