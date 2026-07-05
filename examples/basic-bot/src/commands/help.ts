import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	MessageFlags,
} from "discord.js";

import { router } from "@routes";
import type { Locals } from "@routes/types";

export const help = {
	data: new SlashCommandBuilder()
		.setName("help")
		.setDescription("Getting started"),
	async execute(interaction: ChatInputCommandInteraction, locals: Locals) {
		router.dispatch({
			interaction,
			path: "/help",
			locals,
			flags: [MessageFlags.Ephemeral],
		});
	},
};
