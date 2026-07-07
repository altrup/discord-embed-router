import {
	ActionRowBuilder,
	ButtonStyle,
	EmbedBuilder,
	Interaction,
} from "discord.js";
import { RouteButtonBuilder, RouteHandler, State } from "discord-embed-router";
import type { Locals } from "@routes/types";

export const counter: RouteHandler<"GET", Locals> = (
	interaction: Interaction,
	state: State<Locals>,
) => {
	const counterValue = parseInt(state.queryParams.get("value") ?? "0");

	return {
		embeds: [
			new EmbedBuilder()
				.setColor("#748fc5")
				.setTitle("Counter")
				.setDescription(`**${counterValue}**`),
		],
		components: [
			new ActionRowBuilder()
				.addComponents(
					new RouteButtonBuilder(state.embedRouter)
						.setLabel("Decrease")
						.setStyle(ButtonStyle.Danger)
						.setTo(state.path, {
							query: {
								value: `${counterValue - 1}`,
							},
						}),
				)
				.addComponents(
					new RouteButtonBuilder(state.embedRouter)
						.setLabel("Increase")
						.setStyle(ButtonStyle.Success)
						.setTo(state.path, {
							query: {
								value: `${counterValue + 1}`,
							},
						}),
				)
				.toJSON(),
			new ActionRowBuilder()
				.addComponents(
					new RouteButtonBuilder(state.embedRouter)
						.setLabel("Back")
						.setStyle(ButtonStyle.Secondary)
						.setTo("/catalog"),
				)
				.toJSON(),
		],
	};
};
