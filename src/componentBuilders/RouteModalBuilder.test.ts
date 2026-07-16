import EventEmitter from "node:events";

import { Client, MessageFlags } from "discord.js";
import { expect, test } from "vitest";

import { RouteModalBuilder } from "@componentBuilders/RouteModalBuilder";
import { EmbedRouter } from "@routing/EmbedRouter";
import { ConfigError } from "@src/ConfigError";

const mockClient = (): Client => new EventEmitter() as unknown as Client;

test("setTo's flags option encodes like encodePath's", () => {
	const embedRouter = new EmbedRouter(mockClient());
	const modal = new RouteModalBuilder(embedRouter).setTo("/submit", {
		method: "POST",
		flags: MessageFlags.Ephemeral,
	});

	expect(modal.data.custom_id).toBe(
		embedRouter.encodePath("/submit", {
			method: "POST",
			flags: MessageFlags.Ephemeral,
		}),
	);
});

test("setTo throws a ConfigError for method MODAL, past TypeScript", () => {
	const embedRouter = new EmbedRouter(mockClient());
	const modal = new RouteModalBuilder(embedRouter);

	expect(() =>
		modal.setTo("/x", { method: "MODAL" } as unknown as Parameters<
			typeof modal.setTo
		>[1]),
	).toThrow(ConfigError);
});
