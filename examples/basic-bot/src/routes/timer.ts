import { RouteButtonBuilder, RouteHandler } from "discord-embed-router";
import { ActionRowBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

import {
	DEFAULT_TIMEOUT,
	type Globals,
	type Locals,
	type Session,
} from "@routes/types";

export const timer: RouteHandler<"GET", Globals, Session, Locals> = (
	embedRouter,
	interaction,
	{ path, queryParams },
) => {
	const startTime = parseInt(queryParams.get("startTime") ?? "");
	const dur = parseInt(queryParams.get("dur") ?? "");
	const endTime = startTime + dur;

	const timeout = !isNaN(endTime)
		? setTimeout(() => {
				embedRouter.dispatch(interaction, path);
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
						.setTo(path),
					new RouteButtonBuilder(embedRouter)
						.setLabel("Start")
						.setStyle(ButtonStyle.Success)
						.setDisabled(!isNaN(endTime))
						.setTo(path, {
							queryParams: {
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
		timeout: DEFAULT_TIMEOUT,
	};
};
