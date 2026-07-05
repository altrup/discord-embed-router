import type { CommandImplementation } from "@commands/types";
import { help } from "@commands/help";
import { catalog } from "@commands/catalog";

export const commands: CommandImplementation[] = [help, catalog];
