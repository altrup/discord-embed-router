import { parse, Path, stringify, TokenData } from "path-to-regexp";

export const pathToString = <P extends Path>(
	path: P,
	checkValidity = true,
): string => {
	if (checkValidity) {
		return stringify(path instanceof TokenData ? path : parse(path));
	}
	return typeof path === "string" ? path : stringify(path);
};
