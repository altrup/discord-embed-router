import type { Globals, Locals, Session } from "@routes/types";
import { RouteButtonBuilder, RouteHandler } from "discord-embed-router";
import { ActionRowBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

export const counter: RouteHandler<"GET", Globals, Session, Locals> = (
	embedRouter,
	interaction,
	state,
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
					new RouteButtonBuilder(embedRouter)
						.setLabel("Decrease")
						.setStyle(ButtonStyle.Danger)
						.setTo(state.path, {
							query: {
								value: `${counterValue - 1}`,
							},
						}),
				)
				.addComponents(
					new RouteButtonBuilder(embedRouter)
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
					new RouteButtonBuilder(embedRouter)
						.setLabel("Back")
						.setStyle(ButtonStyle.Secondary)
						.setTo("/catalog"),
				)
				.toJSON(),
		],
	};
};
