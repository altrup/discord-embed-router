import type { Method } from "@routing/types";
import type { MethodEncoding } from "@encoding/types";

export const METHOD_ENCODINGS = ["G", "P", "U", "A", "D"] as const;

export const METHOD_TO_ENCODING: Record<Method, MethodEncoding> = {
	GET: "G",
	POST: "P",
	PUT: "U",
	PATCH: "A",
	DELETE: "D",
};
export const ENCODING_TO_METHOD: Record<MethodEncoding, Method> = {
	G: "GET",
	P: "POST",
	U: "PUT",
	A: "PATCH",
	D: "DELETE",
};
