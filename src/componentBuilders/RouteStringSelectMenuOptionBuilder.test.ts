import EventEmitter from "node:events";

import { Client } from "discord.js";
import { expect, test } from "vitest";

import { RouteStringSelectMenuOptionBuilder } from "@componentBuilders/RouteStringSelectMenuOptionBuilder";
import { EmbedRouter } from "@routing/EmbedRouter";

const mockClient = (): Client => new EventEmitter() as unknown as Client;

test("two options to the same route with different keys get distinct values", () => {
	const embedRouter = new EmbedRouter(mockClient());

	const [a, b] = ["a", "b"].map(
		(key) =>
			new RouteStringSelectMenuOptionBuilder(embedRouter, {
				label: "x",
				to: "/same",
				toOptions: { key },
			}).data.value,
	);

	expect(a).toBeDefined();
	expect(a).not.toBe(b);
});
