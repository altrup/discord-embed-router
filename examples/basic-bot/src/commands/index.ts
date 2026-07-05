import type { CommandImplementation } from "@commands/types";
import { help } from "@commands/help";
import { counter } from "./counter";

export const commands: CommandImplementation[] = [help, counter];
