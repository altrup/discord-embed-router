import { Collection } from "discord.js";
import type { CommandName } from "@commands/types";

export interface Locals {
	commandIds: Collection<CommandName, string>;
}
