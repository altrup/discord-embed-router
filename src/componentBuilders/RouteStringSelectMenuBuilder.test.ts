import EventEmitter from "node:events";

import { Client } from "discord.js";
import { expect, test } from "vitest";

import { RouteStringSelectMenuBuilder } from "@componentBuilders/RouteStringSelectMenuBuilder";
import { EmbedRouter } from "@routing/EmbedRouter";

const mockClient = (): Client => new EventEmitter() as unknown as Client;

test("setPattern allows method MODAL", () => {
	const embedRouter = new EmbedRouter(mockClient());
	const menu = new RouteStringSelectMenuBuilder(embedRouter);

	expect(() => menu.setPattern("/x", { method: "MODAL" })).not.toThrow();
});

test("setPattern allows a non-MODAL method", () => {
	const embedRouter = new EmbedRouter(mockClient());
	const menu = new RouteStringSelectMenuBuilder(embedRouter);

	expect(() => menu.setPattern("/x", { method: "GET" })).not.toThrow();
});
