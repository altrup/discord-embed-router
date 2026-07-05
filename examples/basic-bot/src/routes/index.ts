import { EmbedRouter } from "discord-embed-router";
import type { Locals } from "@routes/types";
import { help } from "@routes/help";
import { counter } from "@routes/counter";

export const router = new EmbedRouter<Locals>();

router.on("/help", help);
router.on("/counter", counter);
