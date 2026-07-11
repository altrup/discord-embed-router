import { Path } from "path-to-regexp";

import { Method } from "@routing/types";

import { pathToString } from "./helpers/pathToString";
import { toError } from "./helpers/toError";

// Config Errors aren't caught by EmbedRouter's internal error detection
export class ConfigError<P extends Path = Path> extends Error {
	constructor(
		message: string,
		{
			method,
			path,
		}: {
			method?: Method | "";
			path?: P;
		} = {},
	) {
		if (method && path)
			super(
				`Error while handling ${method ? `${method} ` : ""}${path ? pathToString(path, false) : ""}`,
				{
					cause: toError(message),
				},
			);
		else super(message);
	}
}
