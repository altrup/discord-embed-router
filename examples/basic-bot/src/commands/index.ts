import { catalog } from "@commands/catalog";
import { help } from "@commands/help";
import type { CommandImplementation } from "@commands/types";

export const commands: CommandImplementation[] = [help, catalog];
