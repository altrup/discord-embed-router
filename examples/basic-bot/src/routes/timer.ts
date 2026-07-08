import { RouteButtonBuilder, RouteHandler } from "discord-embed-router";
import { ActionRowBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

import type { Globals, Locals, Session } from "@routes/types";

export const timer: RouteHandler<"GET", Globals, Session, Locals> = (
	embedRouter,
	interaction,
	state,
) => {
	const startTime = parseInt(state.queryParams.get("startTime") ?? "");
	const dur = parseInt(state.queryParams.get("dur") ?? "");
	const endTime = startTime + dur;

	const timeout = !isNaN(endTime)
		? setTimeout(() => {
				embedRouter.dispatch(interaction, state.path);
			}, endTime - new Date().getTime())
		: null;

	return {
		embeds: [
			new EmbedBuilder()
				.setColor("#c58f74")
				.setTitle("Timer")
				.setDescription(
					isNaN(endTime)
						? "Press start to begin countdown"
						: `<t:${Math.floor(endTime / 1000)}:R>`,
				),
		],
		components: [
			new ActionRowBuilder()
				.addComponents(
					new RouteButtonBuilder(embedRouter)
						.setLabel("Stop")
						.setStyle(ButtonStyle.Danger)
						.setDisabled(isNaN(endTime))
						.setTo(state.path),
					new RouteButtonBuilder(embedRouter)
						.setLabel("Start")
						.setStyle(ButtonStyle.Success)
						.setDisabled(!isNaN(endTime))
						.setTo(state.path, {
							query: {
								startTime: ":ts",
								dur: "30000",
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
		cleanup: () => {
			if (timeout) {
				clearTimeout(timeout);
			}
		},
		timeout: 10 * 60_000,
	};
};
