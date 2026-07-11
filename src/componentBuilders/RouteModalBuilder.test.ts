import EventEmitter from "node:events";

import { Client } from "discord.js";
import { expect, test } from "vitest";

import { RouteModalBuilder } from "@componentBuilders/RouteModalBuilder";
import { EmbedRouter } from "@routing/EmbedRouter";
import { ConfigError } from "@src/ConfigError";

const mockClient = (): Client => new EventEmitter() as unknown as Client;

test("setTo throws a ConfigError for method MODAL, past TypeScript", () => {
	const embedRouter = new EmbedRouter(mockClient());
	const modal = new RouteModalBuilder(embedRouter);

	expect(() =>
		modal.setTo("/x", { method: "MODAL" } as unknown as Parameters<
			typeof modal.setTo
		>[1]),
	).toThrow(ConfigError);
});
