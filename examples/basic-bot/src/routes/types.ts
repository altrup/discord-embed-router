import type { CommandName } from "@commands/types";
import { Collection } from "discord.js";

export type Globals = {
	commandIds: Collection<CommandName, string>;
};

export type Session = unknown;

export type Locals = unknown;
