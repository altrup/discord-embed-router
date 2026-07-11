import { EmbedRouter } from "discord-embed-router";

import { catalog } from "@routes/catalog";
import { counter } from "@routes/counter";
import { help } from "@routes/help";
import { ticTacToe } from "@routes/tic-tac-toe";
import type { Globals, Locals, Session } from "@routes/types";
import { userInfo } from "@routes/user-info";

import { timer } from "./timer";

export const registerRoutes = (
	router: EmbedRouter<Globals, Session, Locals>,
) => {
	router.get("/help", help);

	const catalogRouter = new EmbedRouter<Globals, Session, Locals>();

	catalogRouter.get("", catalog);
	catalogRouter.get("/counter", counter.get);
	catalogRouter.post("/counter", counter.post);
	catalogRouter.get("/user-info", userInfo);
	catalogRouter.get("/user-info/{:userId}", userInfo);
	catalogRouter.get("/timer", timer);
	catalogRouter.get("/tic-tac-toe", ticTacToe.get);
	catalogRouter.post("/tic-tac-toe", ticTacToe.post);
	catalogRouter.put("/tic-tac-toe", ticTacToe.put);
	catalogRouter.patch("/tic-tac-toe", ticTacToe.patch);

	router.use("/catalog", catalogRouter);
};
