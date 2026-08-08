import { RouteHandler } from "discord-embed-router";

import type { Globals, Locals, Session } from "@routes/types";

export const error: RouteHandler<"GET", Globals, Session, Locals> = () => {
	throw new Error("TEST ERROR");
};
