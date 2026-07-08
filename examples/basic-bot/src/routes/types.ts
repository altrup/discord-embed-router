import { Collection } from "discord.js";
import type { CommandName } from "@commands/types";

export type Globals = {
	commandIds: Collection<CommandName, string>;
};

export type Session = unknown;

export type Locals = unknown;
