import {
	ActionRowBuilder,
	ButtonStyle,
	EmbedBuilder,
	Interaction,
} from "discord.js";
import { RouteButtonBuilder, RouteHandler, State } from "discord-embed-router";
import type { Locals } from "@routes/types";

export const timer: RouteHandler<"GET", Locals> = (
	interaction: Interaction,
	state: State<Locals>,
) => {
	const startTime = parseInt(state.query.get("startTime") ?? "");
	const dur = parseInt(state.query.get("dur") ?? "");
	const endTime = startTime + dur;

	const timeout = !isNaN(endTime)
		? setTimeout(() => {
				state.embedRouter.dispatch(interaction, state.path);
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
					new RouteButtonBuilder(state.embedRouter)
						.setLabel("Stop")
						.setStyle(ButtonStyle.Danger)
						.setDisabled(isNaN(endTime))
						.setTo(state.path),
					new RouteButtonBuilder(state.embedRouter)
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
					new RouteButtonBuilder(state.embedRouter)
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
		timeout: Infinity,
	};
};
