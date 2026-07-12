import type { EmbedRouter, RouteHandlers } from "discord-embed-router";
import { RouteButtonBuilder } from "discord-embed-router";
import { ActionRowBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { Path } from "path-to-regexp";

import type { Cell } from "@lib/tic-tac-toe-board";
import { TicTacToeBoard } from "@lib/tic-tac-toe-board";
import type { Globals, Locals, Session } from "@routes/types";
import { DEFAULT_TIMEOUT } from "@routes/types";

const COMPUTER_MOVE_DELAY = 1000;

function statusText(board: TicTacToeBoard): string {
	if (board.winner === "X") return "You win! 🎉";
	if (board.winner === "O") return "Computer wins!";
	if (board.winner === "draw") return "It's a draw!";
	if (board.isComputerTurn) return "Computer is thinking...";
	return "Your turn (X)";
}

function cellButton(
	embedRouter: EmbedRouter<Globals, Session, Locals>,
	path: Path,
	board: TicTacToeBoard,
	index: number,
) {
	const value: Cell = board.cells[index] ?? null;
	return new RouteButtonBuilder(embedRouter)
		.setLabel(value ?? "\u200b")
		.setStyle(
			value === "X"
				? ButtonStyle.Danger
				: value === "O"
					? ButtonStyle.Primary
					: ButtonStyle.Secondary,
		)
		.setDisabled(value !== null || board.isOver || board.isComputerTurn)
		.setTo(path, {
			method: "POST",
			queryParams: { cell: `${index}` },
		});
}

export const ticTacToe = {
	get: (embedRouter, interaction, { path, session }) => {
		const board = new TicTacToeBoard(session.get()?.ticTacToeBoard);

		// board's turn: give the player a beat to see their move land before
		// the board updates again, then let the computer actually take its turn
		const computerMoveTimer = board.isComputerTurn
			? setTimeout(() => {
					void embedRouter.dispatch(interaction, path, { method: "PATCH" });
				}, COMPUTER_MOVE_DELAY)
			: null;

		return {
			embeds: [
				new EmbedBuilder()
					.setColor("#70b386")
					.setTitle("Tic-Tac-Toe")
					.setDescription(statusText(board)),
			],
			components: [
				new ActionRowBuilder()
					.addComponents(
						cellButton(embedRouter, path, board, 0),
						cellButton(embedRouter, path, board, 1),
						cellButton(embedRouter, path, board, 2),
					)
					.toJSON(),
				new ActionRowBuilder()
					.addComponents(
						cellButton(embedRouter, path, board, 3),
						cellButton(embedRouter, path, board, 4),
						cellButton(embedRouter, path, board, 5),
					)
					.toJSON(),
				new ActionRowBuilder()
					.addComponents(
						cellButton(embedRouter, path, board, 6),
						cellButton(embedRouter, path, board, 7),
						cellButton(embedRouter, path, board, 8),
					)
					.toJSON(),
				new ActionRowBuilder()
					.addComponents([
						new RouteButtonBuilder(embedRouter)
							.setLabel("Back")
							.setStyle(ButtonStyle.Secondary)
							.setTo("/catalog"),
						new RouteButtonBuilder(embedRouter)
							.setLabel(board.isOver ? "Play Again" : "Restart")
							.setStyle(board.isOver ? ButtonStyle.Success : ButtonStyle.Danger)
							.setTo(path, { method: "PUT" }),
					])
					.toJSON(),
			],
			cleanup: (newState) => {
				if (computerMoveTimer) clearTimeout(computerMoveTimer);

				if (newState && newState.path !== path) {
					newState.session.delete();
				}
			},
			timeout: DEFAULT_TIMEOUT,
		};
	},
	post: (_embedRouter, _interaction, { session, queryParams, path }) => {
		const board = new TicTacToeBoard(session.get()?.ticTacToeBoard);
		const cell = parseInt(queryParams.get("cell") ?? "");

		if (!isNaN(cell)) board.playerMove(cell);

		session.set({
			...session.get(),
			ticTacToeBoard: board,
		});

		return { redirect: path };
	},
	put: (_embedRouter, _interaction, { session, path }) => {
		session.delete();

		return { redirect: path };
	},
	patch: (_embedRouter, _interaction, { session, path }) => {
		const board = new TicTacToeBoard(session.get()?.ticTacToeBoard);
		if (board.isComputerTurn) board.computerMove();

		session.set({
			...session.get(),
			ticTacToeBoard: board,
		});

		return { redirect: path };
	},
} satisfies RouteHandlers<Globals, Session, Locals>;
