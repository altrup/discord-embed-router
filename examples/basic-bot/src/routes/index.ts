import { EmbedRouter } from "discord-embed-router";
import type { Locals } from "@routes/types";
import { help } from "@routes/help";
import { catalog } from "@routes/catalog";
import { counter } from "@routes/counter";

export const router = new EmbedRouter<Locals>();

router.get("/help", help);
router.get("/catalog", catalog);
router.get("/catalog/counter", counter);
