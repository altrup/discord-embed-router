import type { MethodEncoding } from "@encoding/types";
import type { Method } from "@routing/types";

export const METHOD_ENCODINGS = ["G", "P", "U", "A", "D", "M"] as const;

export const METHOD_TO_ENCODING: Record<Method, MethodEncoding> = {
	GET: "G",
	POST: "P",
	PUT: "U",
	PATCH: "A",
	DELETE: "D",
	MODAL: "M",
};
export const ENCODING_TO_METHOD: Record<MethodEncoding, Method> = {
	G: "GET",
	P: "POST",
	U: "PUT",
	A: "PATCH",
	D: "DELETE",
	M: "MODAL",
};
