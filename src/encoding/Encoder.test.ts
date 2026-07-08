import { expect, test } from "vitest";

import { Encoder } from "@encoding/Encoder";
import { Method } from "@routing/types";
import { ID_PREFIX } from "@src/consts";

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
