import EventEmitter from "node:events";

import { Client } from "discord.js";
import { expect, test } from "vitest";

import { RouteButtonBuilder } from "@componentBuilders/RouteButtonBuilder";
import { EmbedRouter } from "@routing/EmbedRouter";
import { ConfigError } from "@src/ConfigError";

const mockClient = (): Client => new EventEmitter() as unknown as Client;

test("setTo throws a ConfigError for method MODAL, past TypeScript", () => {
	const embedRouter = new EmbedRouter(mockClient());
	const button = new RouteButtonBuilder(embedRouter);

	expect(() =>
		button.setTo("/x", { method: "MODAL" } as unknown as Parameters<
			typeof button.setTo
		>[1]),
	).toThrow(ConfigError);
});

test("setTo allows a non-MODAL method", () => {
	const embedRouter = new EmbedRouter(mockClient());
	const button = new RouteButtonBuilder(embedRouter);

	expect(() => button.setTo("/x", { method: "GET" })).not.toThrow();
});
