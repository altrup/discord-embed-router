import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	MessageFlags,
} from "discord.js";
import { EmbedRouter } from "discord-embed-router";
import { Globals, Locals, Session } from "@routes/types";

export const help = {
	data: new SlashCommandBuilder()
		.setName("help")
		.setDescription("Getting started"),
	async execute(
		router: EmbedRouter<Globals, Session, Locals>,
		interaction: ChatInputCommandInteraction,
	) {
		router.dispatch(interaction, "/help", {
			flags: [MessageFlags.Ephemeral],
		});
	},
};
