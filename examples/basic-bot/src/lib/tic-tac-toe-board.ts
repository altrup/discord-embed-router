export type Player = "X" | "O";
export type Cell = Player | null;

const WIN_LINES: readonly (readonly [number, number, number])[] = [
	[0, 1, 2],
	[3, 4, 5],
	[6, 7, 8],
	[0, 3, 6],
	[1, 4, 7],
	[2, 5, 8],
	[0, 4, 8],
	[2, 4, 6],
];

export type TicTacToeBoardState = {
	cells: Cell[];
	winner: Player | "draw" | null;
};

export class TicTacToeBoard {
	cells: Cell[];
	winner: Player | "draw" | null;

	// session data round-trips through structuredClone, which strips class
	// prototypes; rehydrate from that plain state instead of storing instances
	constructor(state?: TicTacToeBoardState) {
		this.cells = state?.cells ?? new Array(9).fill(null);
		this.winner = state?.winner ?? null;
	}

	get isOver(): boolean {
		return this.winner !== null;
	}

	// X always moves first, so equal counts means it's the player's turn
	get isComputerTurn(): boolean {
		const xCount = this.cells.filter((cell) => cell === "X").length;
		const oCount = this.cells.filter((cell) => cell === "O").length;
		return !this.isOver && xCount > oCount;
	}

	playerMove(index: number): void {
		if (this.isOver || this.cells[index] !== null) return;
		this.cells[index] = "X";
		this.#updateWinner();
	}

	computerMove(): void {
		if (this.isOver) return;
		const index = this.#pickComputerMove();
		if (index === undefined) return;
		this.cells[index] = "O";
		this.#updateWinner();
	}

	reset(): void {
		this.cells = new Array(9).fill(null);
		this.winner = null;
	}

	#updateWinner(): void {
		for (const [a, b, c] of WIN_LINES) {
			const value = this.cells[a];
			if (value && value === this.cells[b] && value === this.cells[c]) {
				this.winner = value;
				return;
			}
		}
		if (this.cells.every((cell) => cell !== null)) this.winner = "draw";
	}

	#findWinningMove(player: Player): number | undefined {
		for (const line of WIN_LINES) {
			const values = line.map((index) => this.cells[index]);
			const playerCount = values.filter((value) => value === player).length;
			const emptyCount = values.filter((value) => value === null).length;
			if (playerCount === 2 && emptyCount === 1) {
				return line[values.indexOf(null)];
			}
		}
		return undefined;
	}

	#pickComputerMove(): number | undefined {
		const emptyCells = this.cells
			.map((cell, index) => (cell === null ? index : undefined))
			.filter((index): index is number => index !== undefined);
		if (emptyCells.length === 0) return undefined;

		return (
			this.#findWinningMove("O") ??
			this.#findWinningMove("X") ??
			(this.cells[4] === null ? 4 : undefined) ??
			[0, 2, 6, 8].find((index) => this.cells[index] === null) ??
			emptyCells[0]
		);
	}
}
