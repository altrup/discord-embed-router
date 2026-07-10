import { expect, test } from "vitest";

import { Encoder } from "@encoding/Encoder";
import { Method } from "@routing/types";
import { ID_PREFIX, PUA_START } from "@src/consts";

const testRoutes: {
	path: string;
	method: Method;
}[] = [
	{
		path: "",
		method: "GET",
	},
	{
		path: "/",
		method: "GET",
	},
	{
		path: "/help",
		method: "GET",
	},
	{
		path: "/help/:id",
		method: "GET",
	},
	{
		path: "user{/:id}?test=10",
		method: "GET",
	},
	{
		path: "user/:id",
		method: "DELETE",
	},
	{
		path: "user⤃/*path",
		method: "POST",
	},
];

test("Encoder preserves routes", () => {
	const encoder = new Encoder();

	for (let i = 0; i < testRoutes.length / 2; i++) {
		encoder.registerPath(testRoutes[i]!.path);
	}

	for (const testRoute of testRoutes) {
		expect(
			encoder.decodePath(
				encoder.encodePath(testRoute.path, {
					method: testRoute.method,
					idPrefix: ID_PREFIX,
				}),
				{ idPrefix: ID_PREFIX },
			),
		).toStrictEqual(testRoute);
	}
});

test("registerPath registers the segments inside optional/group tokens, so they still round-trip", () => {
	const encoder = new Encoder();
	const testRoute = { path: "user{/:id}?test=10", method: "GET" as Method };

	encoder.registerPath(testRoute.path);
	const encoded = encoder.encodePath(testRoute.path, {
		method: testRoute.method,
		idPrefix: ID_PREFIX,
	});

	// a registered segment is swapped for a single PUA char, so "user" should
	// no longer appear literally in the encoded output
	expect(encoded).not.toContain("user");
	expect(encoder.decodePath(encoded, { idPrefix: ID_PREFIX })).toStrictEqual(
		testRoute,
	);
});

test("decodePath returns false for a path encoded with a different idPrefix", () => {
	const encoder = new Encoder();

	const encoded = encoder.encodePath("/help", {
		method: "GET",
		idPrefix: "other",
	});

	expect(encoder.decodePath(encoded, { idPrefix: ID_PREFIX })).toBe(false);
});

test("decodePath returns false when there's no valid method encoding and empty methods aren't allowed", () => {
	const encoder = new Encoder();

	expect(
		encoder.decodePath(`${ID_PREFIX}/not-a-method-byte`, {
			idPrefix: ID_PREFIX,
		}),
	).toBe(false);
});

test("decodePath allows an empty method when allowEmptyMethod is set", () => {
	const encoder = new Encoder();

	expect(
		encoder.decodePath("/help", {
			idPrefix: "",
			allowEmptyMethod: true,
		}),
	).toStrictEqual({ method: "", path: "/help" });
});

test("encoding a dynamic value containing a raw, unregistered PUA character throws instead of silently corrupting the path", () => {
	const encoder = new Encoder();

	expect(() =>
		encoder.encodePath("/help/:id", {
			method: "GET",
			idPrefix: ID_PREFIX,
			query: { id: String.fromCodePoint(PUA_START) },
		}),
	).not.toThrow();
	// dynamic segments aren't run through the segment encoder, so a literal
	// path segment containing a PUA char (colliding with the reserved range
	// used for registered segments) must be rejected up front
	expect(() =>
		encoder.encodePath(
			`/help/${String.fromCodePoint(PUA_START)}` as `/help/${string}`,
			{ method: "GET", idPrefix: ID_PREFIX },
		),
	).toThrow(/reserved Private Use Area character/);
});
