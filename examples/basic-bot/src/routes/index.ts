import { catalog } from "@routes/catalog";
import { counter } from "@routes/counter";
import { help } from "@routes/help";
import type { Globals, Locals, Session } from "@routes/types";
import { userInfo } from "@routes/user-info";
import { EmbedRouter } from "discord-embed-router";

import { timer } from "./timer";

export const registerRoutes = (
	router: EmbedRouter<Globals, Session, Locals>,
) => {
	router.get("/help", help);

	const catalogRouter = new EmbedRouter<Globals, Session, Locals>();

	catalogRouter.get("", catalog);
	catalogRouter.get("/counter", counter);
	catalogRouter.get("/user-info", userInfo);
	catalogRouter.get("/user-info/{:userId}", userInfo);
	catalogRouter.get("/timer", timer);

	router.use("/catalog", catalogRouter);
};
