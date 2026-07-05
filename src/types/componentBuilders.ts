import { Path } from "path-to-regexp";
import { Method } from "./routes";

export type SetOptions<P extends Path> = {
	method?: Method;
	path: P;
	query?: ConstructorParameters<typeof URLSearchParams>[0] | undefined;
};

export const isSetOptions = <P extends Path>(
	u: unknown,
): u is SetOptions<P> => {
	return (
		typeof u === "object" &&
		u !== null &&
		(!("method" in u) ||
			("method" in u && typeof u.method === "string") ||
			u.method === undefined) &&
		"path" in u &&
		typeof u.path === "string" &&
		(!("query" in u) ||
			("query" in u && (typeof u.query) in ["object", "string"]) ||
			u.query === undefined)
	);
};
