import { Method } from "./types/routes";

export const ID_PREFIX = "der";
export const METHOD_TO_ENCODING: Record<Method, string> = {
	GET: "G",
	POST: "P",
	PUT: "U",
	PATCH: "A",
	DELETE: "D",
};
export const ENCODING_TO_METHOD: Record<string, Method> = {
	G: "GET",
	P: "POST",
	U: "PUT",
	A: "PATCH",
	D: "DELETE",
};
// base url is never sent; only used for processing locally
export const BASE_URL = "discord://embed.router";

export const PUA_START = 0xe000;
export const PUA_END = 0xf8ff;
export const PUA_RANGE = PUA_END - PUA_START + 1;
