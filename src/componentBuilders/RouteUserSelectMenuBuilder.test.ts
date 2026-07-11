import EventEmitter from "node:events";

import { Client } from "discord.js";
import { expect, test } from "vitest";

import { RouteUserSelectMenuBuilder } from "@componentBuilders/RouteUserSelectMenuBuilder";
import { EmbedRouter } from "@routing/EmbedRouter";

const mockClient = (): Client => new EventEmitter() as unknown as Client;

test("setPattern allows method MODAL", () => {
	const embedRouter = new EmbedRouter(mockClient());
	const menu = new RouteUserSelectMenuBuilder(embedRouter);

	expect(() => menu.setPattern("/x", { method: "MODAL" })).not.toThrow();
});
