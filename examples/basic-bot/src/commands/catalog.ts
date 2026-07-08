import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	MessageFlags,
} from "discord.js";

import { EmbedRouter } from "discord-embed-router";
import { Globals, Locals, Session } from "@routes/types";

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
