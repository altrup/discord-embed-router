import { join } from "node:path";
import {
	ActionRowBuilder,
	ButtonStyle,
	EmbedBuilder,
	Interaction,
} from "discord.js";
import {
	RouteButtonBuilder,
	RouteHandler,
	RouteUserSelectMenuBuilder,
	State,
} from "discord-embed-router";
import type { Locals } from "@routes/types";

export const userInfo: RouteHandler<Locals> = async (
	interaction: Interaction,
	state: State<Locals>,
) => {
	const userId =
		typeof state.params.userId === "string" ? state.params.userId : undefined;
	const user =
		typeof userId === "string"
			? await interaction.client.users.fetch(userId)
			: null;

	return {
		embeds: [
			new EmbedBuilder()
				.setColor("#b472a8")
				.setTitle("User Info")
				.setDescription(
					user ? `Viewing ${user}'s info` : `View someone's user info`,
				)
				.addFields(
					user
						? [
								{
									name: "ID",
									value: `${user?.id}`,
									inline: true,
								},
								{
									name: "Created",
									value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
									inline: true,
								},
							]
						: [],
				),
		],
		components: [
			new ActionRowBuilder()
				.addComponents(
					new RouteUserSelectMenuBuilder(
						state.embedRouter,
						join(state.path.replace(userId ?? "", ""), ":userId"),
					)
						.setPlaceholder("Choose a user")
						.setDefaultUsers(userId ? [userId] : []),
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
