import type { CommandName } from "@commands/types";
import { Collection } from "discord.js";

import type { ProfileStore } from "@lib/profile-store";
import type { TicTacToeBoard } from "@lib/tic-tac-toe-board";

export type Globals = {
	commandIds: Collection<CommandName, string>;
};

export type Session = {
	ticTacToeBoard?: TicTacToeBoard;
	count?: number;
};

// injected per-dispatch via setLocalsProvider (see src/index.ts); holds
// long-lived services like database access, in contrast to Session's
// ephemeral per-message state
export type Locals = {
	profiles: ProfileStore;
};

export const DEFAULT_TIMEOUT = 10 * 60_000;
