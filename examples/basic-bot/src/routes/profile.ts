import { RouteButtonBuilder, RouteHandler } from "discord-embed-router";
import { ActionRowBuilder, ButtonStyle, EmbedBuilder, time } from "discord.js";

import type { Globals, Locals, Session } from "@routes/types";

// Demonstrates locals: persistent per-user data lives in a store injected
// via setLocalsProvider (see src/index.ts), while sessions stay reserved
// for ephemeral per-message state.
export const profile: RouteHandler<"GET", Globals, Session, Locals> = async (
	embedRouter,
	interaction,
	{ locals },
) => {
	if (!locals)
		throw new Error("No locals provider registered; see src/index.ts");

	const previous = await locals.profiles.getProfile(interaction.user.id);
	const current = await locals.profiles.recordVisit(interaction.user.id);

	return {
		embeds: [
			new EmbedBuilder()
				.setColor("#7a74c5")
				.setTitle("Profile")
				.setDescription(
					previous
						? `You've visited this page ${current.visits} times. Last visit: ${time(new Date(previous.lastVisit), "R")}.`
						: "Welcome! This is your first visit.",
				)
				.setFooter({
					text: "This count is read through state.locals and survives bot restarts",
				}),
		],
		components: [
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
