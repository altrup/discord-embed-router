import { expect, test } from "vitest";

import { Location } from "@helpers/Location";

test("pathname is preserved when the query contains characters the URL parser percent-encodes", () => {
	const location = new Location("/foo?a=hello world");
	expect(location.pathname).toBe("/foo");
});
