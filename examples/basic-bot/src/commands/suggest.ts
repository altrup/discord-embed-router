import { EmbedRouter } from "discord-embed-router";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { Globals, Locals, Session } from "@routes/types";

export const suggest = {
	data: new SlashCommandBuilder()
		.setName("suggest")
		.setDescription("Make a suggestion"),
	async execute(
		router: EmbedRouter<Globals, Session, Locals>,
		interaction: ChatInputCommandInteraction,
	) {
		// no flags: modals accept none; the modal's setTo carries the reply
		// flags for its submission instead
		await router.dispatch(interaction, "/suggest", { method: "MODAL" });
	},
};
