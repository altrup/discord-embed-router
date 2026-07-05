import { Path } from "path-to-regexp";
import { BASE_URL, METHOD_TO_ENCODING } from "../consts";
import { pathToString } from "./pathToString";
import { Method } from "../types/routes";

export const encodePath = <AllowEmptyMethod extends boolean = false>({
	idPrefix,
	method,
	path,
	query,
}: {
	idPrefix: string;
	method: AllowEmptyMethod extends false ? Method : Method | "";
	path: Path;
	query?: ConstructorParameters<typeof URLSearchParams>[0] | undefined;
}) => {
	const url = new URL(pathToString(path), BASE_URL);
	if (query) {
		for (const [key, value] of new URLSearchParams(query)) {
			url.searchParams.set(key, value);
		}
	}
	return `${idPrefix}${method === "" ? "" : METHOD_TO_ENCODING[method as Method]}${url.pathname}${url.search}`;
};
