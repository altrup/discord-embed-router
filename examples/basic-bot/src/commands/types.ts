import type { Globals, Locals, Session } from "@routes/types";
import { EmbedRouter } from "discord-embed-router";
import type {
	ChatInputCommandInteraction,
	SharedSlashCommand,
} from "discord.js";

export const commandNamesList = ["help", "catalog"] as const;
export type CommandName = (typeof commandNamesList)[number];

const commandNames = new Set<CommandName>(commandNamesList);
export const isCommandName = (
	commandName: string,
): commandName is CommandName => {
	return commandNames.has(commandName as CommandName);
};

export type CommandImplementation = {
	data: SharedSlashCommand;
	execute: (
		router: EmbedRouter<Globals, Session, Locals>,
		interaction: ChatInputCommandInteraction,
		globals: Globals,
	) => Promise<void>;
};
