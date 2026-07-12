import { expect, test } from "vitest";

import { Location } from "@helpers/Location";

test("pathname is preserved when the query contains characters the URL parser percent-encodes", () => {
	const location = new Location("/foo?a=hello world");
	expect(location.pathname).toBe("/foo");
});

test("query params serialize without percent-encoding characters that survive parsing", () => {
	const location = new Location("/foo", { q: ":ts", "": " x" });
	expect(location.toString()).toBe("/foo?q=:ts&= x");
});

test("query params containing reserved characters round-trip through serialization", () => {
	const reserved = "a&b=c%d+e#f\tg\nh\ri?j";
	const location = new Location("/foo", { [reserved]: reserved, plain: "x" });

	const reparsed = new Location(location.toString());

	expect([...reparsed.queryParams]).toEqual([...location.queryParams]);
});
