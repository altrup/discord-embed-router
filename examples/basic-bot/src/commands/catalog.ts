import { Globals, Locals, Session } from "@routes/types";
import { EmbedRouter } from "discord-embed-router";
import {
	ChatInputCommandInteraction,
	MessageFlags,
	SlashCommandBuilder,
} from "discord.js";

export const catalog = {
	data: new SlashCommandBuilder()
		.setName("catalog")
		.setDescription("Command Catalog"),
	async execute(
		router: EmbedRouter<Globals, Session, Locals>,
		interaction: ChatInputCommandInteraction,
	) {
		router.dispatch(interaction, "/catalog", {
			flags: [MessageFlags.Ephemeral],
		});
	},
};
