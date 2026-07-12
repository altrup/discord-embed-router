import { EmbedRouter } from "discord-embed-router";

import { catalog } from "@routes/catalog";
import { counter } from "@routes/counter";
import { help } from "@routes/help";
import { profile } from "@routes/profile";
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
	catalogRouter.route("/counter", counter);
	catalogRouter.get("/user-info", userInfo);
	catalogRouter.get("/user-info/{:userId}", userInfo);
	catalogRouter.get("/timer", timer);
	catalogRouter.get("/profile", profile);
	catalogRouter.route("/tic-tac-toe", ticTacToe);

	router.use("/catalog", catalogRouter);
};
