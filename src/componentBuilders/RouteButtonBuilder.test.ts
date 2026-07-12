import EventEmitter from "node:events";

import { ButtonStyle, Client } from "discord.js";
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

test("two buttons to the same route with different keys get distinct customIds", () => {
	const embedRouter = new EmbedRouter(mockClient());

	const [a, b] = ["a", "b"].map((key) => {
		const json = new RouteButtonBuilder(embedRouter, {
			label: "x",
			style: ButtonStyle.Primary,
			to: "/same",
			toOptions: { key },
		}).toJSON();
		return "custom_id" in json ? json.custom_id : undefined;
	});

	expect(a).toBeDefined();
	expect(a).not.toBe(b);
});
