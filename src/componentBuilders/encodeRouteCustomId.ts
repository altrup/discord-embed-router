import { Path } from "path-to-regexp";

import { isMethod } from "@helpers/isMethod";
import type { EmbedRouter } from "@routing/EmbedRouter";
import { ConfigError } from "@src/ConfigError";

// shared body of every Route*Builder's setTo/setPattern
export function encodeRouteCustomId<Globals, Session, Locals, P extends Path>(
	embedRouter: EmbedRouter<Globals, Session, Locals>,
	builderName: string,
	path: P,
	method: unknown,
	query: ConstructorParameters<typeof URLSearchParams>[0] | undefined,
): string {
	if (!isMethod(method))
		throw new ConfigError(`Invalid method "${method}" for ${builderName}`);
	return embedRouter.encodePath(path, { method, query });
}
