import { EmbedRouter } from "discord-embed-router";
import type { Locals } from "@routes/types";
import { help } from "@routes/help";
import { catalog } from "@routes/catalog";
import { counter } from "@routes/counter";
import { userInfo } from "@routes/user-info";
import { timer } from "./timer";

export const router = new EmbedRouter<Locals>();

router.get("/help", help);

const catalogRouter = new EmbedRouter<Locals>();

catalogRouter.get("", catalog);
catalogRouter.get("/counter", counter);
catalogRouter.get("/user-info", userInfo);
catalogRouter.get("/user-info/{:userId}", userInfo);
catalogRouter.get("/timer", timer);

router.use("/catalog", catalogRouter);
