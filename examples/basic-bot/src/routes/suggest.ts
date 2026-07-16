import { RouteHandlers, RouteModalBuilder } from "discord-embed-router";
import {
	EmbedBuilder,
	LabelBuilder,
	MessageFlags,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";

import type { Globals, Locals, Session } from "@routes/types";

// a command-launched modal: /suggest shows the modal directly, its
// submission POSTs back here, and the redirect's render displays the result.
// the modal's setTo carries the Ephemeral flag through its customId, so the
// fresh reply its submission creates stays private
export const suggest = {
	get: (embedRouter, interaction, { queryParams }) => ({
		embeds: [
			new EmbedBuilder()
				.setColor("#74c58f")
				.setTitle("Suggestion received")
				.setDescription(queryParams.get("text") || "(empty)"),
		],
	}),
	post: (embedRouter, interaction, { path, fields }) => ({
		redirect: path,
		queryParams: { text: fields?.getTextInputValue("text") ?? "" },
	}),
	modal: (embedRouter, interaction, { path }) =>
		new RouteModalBuilder(embedRouter)
			.setTo(path, { method: "POST", flags: MessageFlags.Ephemeral })
			.setTitle("Make a suggestion")
			.addLabelComponents(
				new LabelBuilder()
					.setId(1)
					.setLabel("Suggestion")
					.setDescription("What should this bot do differently?")
					.setTextInputComponent(
						new TextInputBuilder()
							.setCustomId("text")
							.setStyle(TextInputStyle.Paragraph),
					),
			)
			.toJSON(),
} satisfies RouteHandlers<Globals, Session, Locals>;
