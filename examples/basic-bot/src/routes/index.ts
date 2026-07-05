import { EmbedRouter } from "discord-embed-router";
import type { Locals } from "@routes/types";
import { help } from "@routes/help";
import { catalog } from "@routes/catalog";
import { counter } from "@routes/counter";
import { userInfo } from "@routes/user-info";

export const router = new EmbedRouter<Locals>();

router.get("/help", help);
router.get("/catalog", catalog);
router.get("/catalog/counter", counter);
router.get("/catalog/user-info", userInfo);
router.get("/catalog/user-info/{:userId}", userInfo);
