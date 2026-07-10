import EventEmitter from "node:events";

import { Client } from "discord.js";
import { expect, test } from "vitest";

import { RouteButtonBuilder } from "@componentBuilders/RouteButtonBuilder";
import { RouteModalBuilder } from "@componentBuilders/RouteModalBuilder";
import { RouteStringSelectMenuBuilder } from "@componentBuilders/RouteStringSelectMenuBuilder";
import { RouteStringSelectMenuOptionBuilder } from "@componentBuilders/RouteStringSelectMenuOptionBuilder";
import { RouteUserSelectMenuBuilder } from "@componentBuilders/RouteUserSelectMenuBuilder";
import { EmbedRouter } from "@routing/EmbedRouter";

const embedRouter = new EmbedRouter(new EventEmitter() as unknown as Client);

// only constructible by a JS caller bypassing the constructor data types
const data = (obj: object) => obj as never;

test("builder constructors reject router-owned keys, even past TypeScript", () => {
	expect(
		() => new RouteButtonBuilder(embedRouter, data({ custom_id: "raw" })),
	).toThrow("custom_id is not supported on RouteButtonBuilder");
	expect(
		() => new RouteButtonBuilder(embedRouter, data({ customId: "raw" })),
	).toThrow("customId is not supported on RouteButtonBuilder");
	expect(
		() =>
			new RouteButtonBuilder(embedRouter, data({ url: "https://example.com" })),
	).toThrow("url is not supported on RouteButtonBuilder");
	expect(
		() => new RouteModalBuilder(embedRouter, data({ custom_id: "raw" })),
	).toThrow("custom_id is not supported on RouteModalBuilder");
	expect(
		() => new RouteStringSelectMenuBuilder(embedRouter, data({ options: [] })),
	).toThrow("options is not supported on RouteStringSelectMenuBuilder");
	expect(
		() =>
			new RouteStringSelectMenuOptionBuilder(
				embedRouter,
				data({ label: "x", value: "raw" }),
			),
	).toThrow("value is not supported on RouteStringSelectMenuOptionBuilder");
	expect(
		() =>
			new RouteUserSelectMenuBuilder(embedRouter, data({ customId: "raw" })),
	).toThrow("customId is not supported on RouteUserSelectMenuBuilder");
});

test("builder constructors accept data without router-owned keys", () => {
	expect(
		() => new RouteButtonBuilder(embedRouter, { label: "ok" }),
	).not.toThrow();
	expect(
		() => new RouteModalBuilder(embedRouter, { title: "Edit" }),
	).not.toThrow();
});
