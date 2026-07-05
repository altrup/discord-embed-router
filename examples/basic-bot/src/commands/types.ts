import type {
	ChatInputCommandInteraction,
	SharedSlashCommand,
} from "discord.js";
import type { Locals } from "@routes/types";

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
		interaction: ChatInputCommandInteraction,
		locals: Locals,
	) => Promise<void>;
};
