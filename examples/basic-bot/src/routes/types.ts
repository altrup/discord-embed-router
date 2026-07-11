import type { CommandName } from "@commands/types";
import { Collection } from "discord.js";

import type { TicTacToeBoard } from "../games/tic-tac-toe-board";

export type Globals = {
	commandIds: Collection<CommandName, string>;
};

export type Session = {
	ticTacToeBoard?: TicTacToeBoard;
	count?: number;
};

export type Locals = unknown;

export const DEFAULT_TIMEOUT = 10 * 60_000;
