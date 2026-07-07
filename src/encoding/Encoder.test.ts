import { expect, test } from "vitest";
import { Encoder } from "./Encoder";
import { Method } from "../routing/types";
import { ID_PREFIX } from "../consts";

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
		path: "user/*path",
		method: "POST",
	},
];

const encoder = new Encoder();

for (const testRoute of testRoutes) {
	encoder.registerPath(testRoute.path);
}

test("Encoder preserves routes", () => {
	for (const testRoute of testRoutes) {
		expect(
			encoder.decodePath(
				encoder.encodePath(testRoute.path, {
					method: testRoute.method,
					idPrefix: ID_PREFIX,
				}),
				ID_PREFIX,
			),
		).toStrictEqual(testRoute);
	}
});
