import EventEmitter from "node:events";

import { Client } from "discord.js";
import { expect, test } from "vitest";

import { RouteButtonBuilder } from "@componentBuilders/RouteButtonBuilder";
import { EmbedRouter } from "@routing/EmbedRouter";

const mockClient = (): Client => new EventEmitter() as unknown as Client;

test("setTo allows method MODAL", () => {
	const embedRouter = new EmbedRouter(mockClient());
	const button = new RouteButtonBuilder(embedRouter);

	expect(() => button.setTo("/x", { method: "MODAL" })).not.toThrow();
});

test("setTo allows a non-MODAL method", () => {
	const embedRouter = new EmbedRouter(mockClient());
	const button = new RouteButtonBuilder(embedRouter);

	expect(() => button.setTo("/x", { method: "GET" })).not.toThrow();
});
