import { vi, expect, test } from "vitest";
import EventEmitter from "node:events";
import { ButtonInteraction, Client } from "discord.js";
import { EmbedRouter } from "@routing/EmbedRouter";

const mockClient = (): Client => new EventEmitter() as unknown as Client;

const mockButtonInteraction = (
	customId: string,
	overrides: Partial<ButtonInteraction> = {},
): ButtonInteraction => {
	return {
		customId,
		createdTimestamp: Date.now(),
		replied: false,
		deferred: false,
		isAutocomplete: () => false,
		isButton: () => true,
		isAnySelectMenu: () => false,
		isChatInputCommand: () => false,
		message: { id: "123456789" },
		channel: null,
		deferUpdate: vi.fn(),
		deferReply: vi.fn(),
		reply: vi.fn(),
		editReply: vi.fn(),
		update: vi.fn(),
		fetchReply: vi
			.fn()
			.mockResolvedValue({ id: "123456789", flags: { has: () => false } }),
		...overrides,
	} as unknown as ButtonInteraction;
};

test("No id collisions", () => {
	const client = mockClient();
	expect(new EmbedRouter(client).idPrefix).not.toBe(
		new EmbedRouter(client).idPrefix,
	);
});

test("Router warns about named collisions", () => {
	const client = mockClient();

	const warningSpy = vi
		.spyOn(process, "emitWarning")
		.mockImplementation(() => {});

	new EmbedRouter(client, { name: "embed-router" });
	new EmbedRouter(client, { name: "embed-router" });

	expect(warningSpy).toHaveBeenCalledWith(
		expect.stringContaining("EmbedRouter identifier collision"),
		"DiscordEmbedRouterWarning",
	);
});

test("Router dispatch calls route handler with data", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const handler = vi.fn();
	const buttonInteraction = mockButtonInteraction("");

	embedRouter.get("/test/:id", handler);

	// invalid route
	await expect(
		embedRouter.dispatch(buttonInteraction, "/test?test=3"),
	).rejects.toThrow();

	await embedRouter.dispatch(buttonInteraction, "/test/2?test=3");
	expect(handler).toHaveBeenCalledOnce();

	const [, , data] = handler.mock.calls[0]!;
	expect(data.params).toEqual({ id: "2" });
	expect(data.queryParams.get("test")).toEqual("3");
});

test("Router only listens for interactions with its prefix", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const handler = vi.fn();
	const noPrefixButtonInteraction = mockButtonInteraction(
		embedRouter.encodePath("/test/2", { idPrefix: "", method: "DELETE" }),
	);
	const prefixButtonInteraction = mockButtonInteraction(
		embedRouter.encodePath("/test/3", { method: "DELETE" }),
	);

	embedRouter.delete("/test/:id", handler);

	client.emit("interactionCreate", noPrefixButtonInteraction);
	await vi.waitFor(() => expect(handler).not.toHaveBeenCalled());

	client.emit("interactionCreate", prefixButtonInteraction);
	await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());

	const [, , data] = handler.mock.calls[0]!;
	expect(data.params).toEqual({ id: "3" });
});
