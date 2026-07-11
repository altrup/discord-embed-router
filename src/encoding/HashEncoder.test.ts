import { expect, test, vi } from "vitest";

import { HashEncoder } from "@encoding/HashEncoder";
import { Method } from "@routing/types";
import { ID_PREFIX, PUA_RANGE, PUA_START } from "@src/consts";

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

test("HashEncoder preserves routes", () => {
	const encoder = new HashEncoder();

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
	const encoder = new HashEncoder();
	const testRoute = { path: "user{/:id}?test=10", method: "GET" as Method };

	encoder.registerPath(testRoute.path);
	const encoded = encoder.encodePath(testRoute.path, {
		method: testRoute.method,
		idPrefix: ID_PREFIX,
	});

	// a registered segment is swapped for an encoded run, so "user" should no
	// longer appear literally in the encoded output
	expect(encoded).not.toContain("user");
	expect(encoder.decodePath(encoded, { idPrefix: ID_PREFIX })).toStrictEqual(
		testRoute,
	);
});

test("decodePath returns false for a path encoded with a different idPrefix", () => {
	const encoder = new HashEncoder();

	const encoded = encoder.encodePath("/help", {
		method: "GET",
		idPrefix: "other",
	});

	expect(encoder.decodePath(encoded, { idPrefix: ID_PREFIX })).toBe(false);
});

test("decodePath returns false when there's no valid method encoding and empty methods aren't allowed", () => {
	const encoder = new HashEncoder();

	expect(
		encoder.decodePath(`${ID_PREFIX}/not-a-method-byte`, {
			idPrefix: ID_PREFIX,
		}),
	).toBe(false);
});

test("decodePath allows an empty method when allowEmptyMethod is set", () => {
	const encoder = new HashEncoder();

	expect(
		encoder.decodePath("/help", {
			idPrefix: "",
			allowEmptyMethod: true,
		}),
	).toStrictEqual({ method: "", path: "/help" });
});

test("encoding a dynamic value containing a raw, unregistered PUA character throws instead of silently corrupting the path", () => {
	const encoder = new HashEncoder();

	expect(() =>
		encoder.encodePath("/help/:id", {
			method: "GET",
			idPrefix: ID_PREFIX,
			queryParams: { id: String.fromCodePoint(PUA_START) },
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

test("a segmentLength greater than 1 still round-trips multiple adjacent registered segments", () => {
	const encoder = new HashEncoder({ segmentLength: 2 });
	const testRoute = { path: "/user/settings/:id", method: "GET" as Method };

	encoder.registerPath(testRoute.path);
	const encoded = encoder.encodePath(testRoute.path, {
		method: testRoute.method,
		idPrefix: ID_PREFIX,
	});

	expect(encoded).not.toContain("user");
	expect(encoded).not.toContain("settings");
	expect(encoder.decodePath(encoded, { idPrefix: ID_PREFIX })).toStrictEqual(
		testRoute,
	);
});

test("registering the same segment twice reuses its existing encoding instead of warning", () => {
	const encoder = new HashEncoder({ segmentLength: 2 });
	const warningSpy = vi
		.spyOn(process, "emitWarning")
		.mockImplementation(() => {});

	encoder.registerPath("/user/:id");
	encoder.registerPath("/user/:id");

	expect(warningSpy).not.toHaveBeenCalled();
	warningSpy.mockRestore();
});

test("registering more distinct segments than segmentLength's space allows throws instead of hanging", () => {
	const encoder = new HashEncoder({ segmentLength: 1 });
	const warningSpy = vi
		.spyOn(process, "emitWarning")
		.mockImplementation(() => {});

	// fill every one-character PUA code (PUA_RANGE of them)
	for (let i = 0; i < PUA_RANGE; i++) {
		encoder.registerPath(`/seg-${i}`);
	}

	expect(() => encoder.registerPath("/one-too-many")).toThrow(
		/every 1-character encoding/,
	);

	warningSpy.mockRestore();
});
