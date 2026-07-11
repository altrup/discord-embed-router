import { RouteButtonBuilder, RouteHandler } from "discord-embed-router";
import { ActionRowBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

import { DEFAULT_TIMEOUT, type Globals, type Locals, type Session } from "@routes/types";

export const counter: {
	get: RouteHandler<"GET", Globals, Session, Locals>;
	post: RouteHandler<"POST", Globals, Session, Locals>;
} = {
	get: (embedRouter, interaction, { path, session }) => {
		const counterValue = session.get()?.count ?? 0;

		return {
			embeds: [
				new EmbedBuilder()
					.setColor("#748fc5")
					.setTitle("Counter")
					.setDescription(`**${counterValue}**`),
			],
			components: [
				new ActionRowBuilder()
					.addComponents(
						new RouteButtonBuilder(embedRouter)
							.setLabel("Decrease")
							.setStyle(ButtonStyle.Danger)
							.setTo(path, {
								method: "POST",
								query: {
									delta: "-1",
								},
							}),
					)
					.addComponents(
						new RouteButtonBuilder(embedRouter)
							.setLabel("Increase")
							.setStyle(ButtonStyle.Success)
							.setTo(path, {
								method: "POST",
								query: {
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
			timeout: DEFAULT_TIMEOUT,
		};
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
			redirect: path
		} 
	},
};
