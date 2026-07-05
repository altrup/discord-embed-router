import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	MessageFlags,
} from "discord.js";

import { router } from "@routes";
import type { Locals } from "@routes/types";

export const counter = {
	data: new SlashCommandBuilder()
		.setName("counter")
		.setDescription("Simple Counter Implementation"),
	async execute(interaction: ChatInputCommandInteraction, locals: Locals) {
		router.dispatch(interaction, "/counter", locals, [MessageFlags.Ephemeral]);
	},
};
