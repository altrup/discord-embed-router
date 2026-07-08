import { Globals, Locals, Session } from "@routes/types";
import { EmbedRouter } from "discord-embed-router";
import {
	ChatInputCommandInteraction,
	MessageFlags,
	SlashCommandBuilder,
} from "discord.js";

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
