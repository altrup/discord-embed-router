import { Path } from "path-to-regexp";
import { BASE_URL } from "../consts";
import { pathToString } from "./pathToString";

export const encodePath = (
	idPrefix: string,
	path: Path,
	query?: ConstructorParameters<typeof URLSearchParams>[0],
) => {
	const url = new URL(pathToString(path), BASE_URL);
	if (query) {
		for (const [key, value] of new URLSearchParams(query)) {
			url.searchParams.set(key, value);
		}
	}
	return `${idPrefix}${url.pathname}${url.search}`;
};
