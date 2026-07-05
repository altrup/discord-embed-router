import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	MessageFlags,
} from "discord.js";

import { router } from "@routes";
import type { Locals } from "@routes/types";

export const catalog = {
	data: new SlashCommandBuilder()
		.setName("catalog")
		.setDescription("Command Catalog"),
	async execute(interaction: ChatInputCommandInteraction, locals: Locals) {
		router.dispatch(interaction, "/catalog", {
			locals,
			flags: [MessageFlags.Ephemeral],
		});
	},
};
