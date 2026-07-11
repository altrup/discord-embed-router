import {
	RouteButtonBuilder,
	RouteHandler,
	RouteModalBuilder,
} from "discord-embed-router";
import {
	ActionRowBuilder,
	ButtonStyle,
	EmbedBuilder,
	LabelBuilder,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";

import {
	DEFAULT_TIMEOUT,
	type Globals,
	type Locals,
	type Session,
} from "@routes/types";

const INVALID_WARNING_TIMEOUT = 10_000;

export const counter: {
	get: RouteHandler<"GET", Globals, Session, Locals>;
	put: RouteHandler<"PUT", Globals, Session, Locals>;
	post: RouteHandler<"POST", Globals, Session, Locals>;
	modal: RouteHandler<"MODAL", Globals, Session, Locals>;
} = {
	get: (embedRouter, interaction, { path, session, queryParams }) => {
		const counterValue = session.get()?.count ?? 0;
		const invalidValue = queryParams.get("invalidValue");

		const invalidClearTimer =
			invalidValue !== null
				? setTimeout(() => {
						void embedRouter.dispatch(interaction, path);
					}, INVALID_WARNING_TIMEOUT)
				: null;

		const embed = new EmbedBuilder()
			.setColor("#748fc5")
			.setTitle("Counter")
			.setDescription(`**${counterValue}**`);
		if (invalidValue !== null) {
			embed.addFields({
				name: "⚠️ Invalid Input",
				value: `"${invalidValue || "(empty)"}" is not a valid number.`,
			});
		}

		return {
			embeds: [embed],
			components: [
				new ActionRowBuilder()
					.addComponents(
						new RouteButtonBuilder(embedRouter)
							.setLabel("Decrease")
							.setStyle(ButtonStyle.Danger)
							.setTo(path, {
								method: "POST",
								queryParams: {
									delta: "-1",
								},
							}),
						new RouteButtonBuilder(embedRouter)
							.setLabel("Edit")
							.setStyle(ButtonStyle.Primary)
							.setTo(path, { method: "MODAL" }),
						new RouteButtonBuilder(embedRouter)
							.setLabel("Increase")
							.setStyle(ButtonStyle.Success)
							.setTo(path, {
								method: "POST",
								queryParams: {
									delta: "1",
								},
							}),
					)
					.toJSON(),
				new ActionRowBuilder()
					.addComponents(
						new RouteButtonBuilder(embedRouter)
							.setLabel("Back")
							.setStyle(ButtonStyle.Secondary)
							.setTo("/catalog"),
					)
					.toJSON(),
			],
			cleanup: (newState) => {
				if (invalidClearTimer) clearTimeout(invalidClearTimer);

				if (newState?.path !== path) session.delete();
			},
			timeout: DEFAULT_TIMEOUT,
		};
	},
	put: (_embedRouter, _interaction, { path, session, fields }) => {
		const rawCount = fields?.getTextInputValue("count") ?? "";
		const newCount = parseInt(rawCount);
		if (isNaN(newCount)) {
			// a modal submission can't itself show a modal to retry, so redirect
			// to a renderer with an error and a button to reopen it instead
			return { redirect: path, queryParams: { invalidValue: rawCount } };
		}

		session.set({
			...session.get(),
			count: newCount,
		});

		return { redirect: path };
	},
	post: (embedRouter, interaction, { path, session, queryParams }) => {
		const counterValue = session.get()?.count ?? 0;
		const delta = parseInt(queryParams.get("delta") ?? "0");
		session.set({
			...session.get(),
			count: counterValue + delta,
		});

		return {
			// redirect to GET
			redirect: path,
		};
	},
	modal: (embedRouter, interaction, { session, path }) => {
		const counterValue = session.get()?.count ?? 0;

		return new RouteModalBuilder(embedRouter)
			.setTo(path, {
				method: "PUT",
			})
			.setTitle("Set Count")
			.addLabelComponents(
				new LabelBuilder()
					.setId(1)
					.setLabel("New Count")
					.setDescription("Set counter to an arbitrary number")
					.setTextInputComponent(
						new TextInputBuilder()
							.setCustomId("count")
							.setStyle(TextInputStyle.Short)
							.setPlaceholder(counterValue.toString()),
					),
			)
			.toJSON();
	},
};
