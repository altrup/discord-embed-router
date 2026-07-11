import EventEmitter from "node:events";

import { Client } from "discord.js";
import { expect, test } from "vitest";

import { RouteStringSelectMenuBuilder } from "@componentBuilders/RouteStringSelectMenuBuilder";
import { EmbedRouter } from "@routing/EmbedRouter";
import { ConfigError } from "@src/ConfigError";

const mockClient = (): Client => new EventEmitter() as unknown as Client;

test("setPattern throws a ConfigError for method MODAL, past TypeScript", () => {
	const embedRouter = new EmbedRouter(mockClient());
	const menu = new RouteStringSelectMenuBuilder(embedRouter);

	expect(() =>
		menu.setPattern("/x", { method: "MODAL" } as unknown as Parameters<
			typeof menu.setPattern
		>[1]),
	).toThrow(ConfigError);
});

test("setPattern allows a non-MODAL method", () => {
	const embedRouter = new EmbedRouter(mockClient());
	const menu = new RouteStringSelectMenuBuilder(embedRouter);

	expect(() => menu.setPattern("/x", { method: "GET" })).not.toThrow();
});
