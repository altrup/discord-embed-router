import EventEmitter from "node:events";

import { ButtonInteraction, Client, ModalSubmitInteraction } from "discord.js";
import { expect, test, vi } from "vitest";

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
		isMessageComponent: () => true,
		isButton: () => true,
		isAnySelectMenu: () => false,
		isChatInputCommand: () => false,
		isModalSubmit: () => false,
		message: { id: "123456789", flags: { has: () => false } },
		channel: null,
		deferUpdate: vi.fn(),
		deferReply: vi.fn(),
		reply: vi.fn(),
		editReply: vi.fn(),
		update: vi.fn(),
		showModal: vi.fn(),
		fetchReply: vi
			.fn()
			.mockResolvedValue({ id: "123456789", flags: { has: () => false } }),
		...overrides,
	} as unknown as ButtonInteraction;
};

const mockModalSubmitInteraction = (
	customId: string,
	overrides: Partial<ModalSubmitInteraction> = {},
): ModalSubmitInteraction => {
	return {
		customId,
		id: "987654321",
		createdTimestamp: Date.now(),
		replied: false,
		deferred: false,
		isAutocomplete: () => false,
		isMessageComponent: () => false,
		isButton: () => false,
		isAnySelectMenu: () => false,
		isChatInputCommand: () => false,
		isModalSubmit: () => true,
		fields: { getTextInputValue: () => "typed value" },
		message: { id: "123456789", flags: { has: () => false } },
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
	} as unknown as ModalSubmitInteraction;
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

test("dispatch throws a ConfigError if a route sets a session or cleanup without a finite timeout", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

	embedRouter.get("/set", (_router, _interaction, state) => {
		state.session.set("hello");
		return {};
	});

	await expect(
		embedRouter.dispatch(mockButtonInteraction(""), "/set"),
	).rejects.toThrow(
		"Timeout is required for components using cleanups or sessions",
	);
});

test("a session committed by one dispatch is seeded into a later dispatch on the same message", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

	embedRouter.get("/set", (_router, _interaction, state) => {
		state.session.set("hello");
		return { timeout: 5000 };
	});

	let seenSession: string | undefined;
	embedRouter.get("/read", (_router, _interaction, state) => {
		seenSession = state.session.get();
		state.session.delete();
		return {};
	});

	// same message.id by default, as if two clicks on the same embed
	await embedRouter.dispatch(mockButtonInteraction(""), "/set");
	await embedRouter.dispatch(mockButtonInteraction(""), "/read");

	expect(seenSession).toBe("hello");
});

test("taking over a message's cleanup runs the previous cleanupFn with the new dispatch's state, not undefined", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

	const cleanupFn = vi.fn();
	embedRouter.get("/a", (_router, _interaction, state) => {
		state.session.set("hello");
		return { cleanup: cleanupFn, timeout: 5000 };
	});
	embedRouter.get("/b", (_router, _interaction, state) => {
		// this dispatch doesn't want a session of its own
		state.session.delete();
		return {};
	});

	await embedRouter.dispatch(mockButtonInteraction(""), "/a");
	await embedRouter.dispatch(mockButtonInteraction(""), "/b");

	expect(cleanupFn).toHaveBeenCalledOnce();
	const [newState] = cleanupFn.mock.calls[0]!;
	expect(newState).not.toBeUndefined();
	expect(newState.path).toBe("/b");
});

test("cleanupFn's `this` is bound to the RouteRender it was returned from", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

	let boundToResponse = false;
	const response = {
		cleanup: function (this: unknown) {
			boundToResponse = this === response;
			return undefined;
		},
		timeout: 5000,
	};
	embedRouter.get("/a", (_router, _interaction, state) => {
		state.session.set("hello");
		return response;
	});
	embedRouter.get("/b", (_router, _interaction, state) => {
		state.session.delete();
		return {};
	});

	await embedRouter.dispatch(mockButtonInteraction(""), "/a");
	await embedRouter.dispatch(mockButtonInteraction(""), "/b");

	expect(boundToResponse).toBe(true);
});

test("a real timeout runs the cleanupFn with undefined, applies its result to the message, and clears the session", async () => {
	vi.useFakeTimers();
	try {
		const client = mockClient();
		const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

		const editMessage = vi.fn();
		const cleanupFn = vi.fn().mockReturnValue({ content: "timed out" });
		embedRouter.get("/a", (_router, _interaction, state) => {
			state.session.set("hello");
			return { cleanup: cleanupFn, timeout: 1000 };
		});

		const overrides = {
			channel: { messages: { edit: editMessage } },
		} as unknown as Partial<ButtonInteraction>;
		await embedRouter.dispatch(mockButtonInteraction("", overrides), "/a");

		await vi.advanceTimersByTimeAsync(1000);

		expect(cleanupFn).toHaveBeenCalledExactlyOnceWith(undefined);
		expect(editMessage).toHaveBeenCalledWith("123456789", {
			content: "timed out",
		});

		// session was cleared by the real timeout, so a later dispatch that
		// doesn't set its own session shouldn't see the stale one
		let seenSession: string | undefined = "not read yet";
		embedRouter.get("/read", (_router, _interaction, state) => {
			seenSession = state.session.get();
			return {};
		});
		await embedRouter.dispatch(mockButtonInteraction(""), "/read");
		expect(seenSession).toBeUndefined();
	} finally {
		vi.useRealTimers();
	}
});

test("a route handler can redirect to another registered GET path, which renders instead", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const getHandler = vi.fn().mockReturnValue({ content: "item 5" });
	embedRouter.get("/item/:id", getHandler);
	embedRouter.delete("/item/:id", (_router, _interaction, state) => {
		return { redirect: `/item/${state.params.id}` };
	});

	await embedRouter.dispatch(mockButtonInteraction(""), "/item/5", {
		method: "DELETE",
	});

	expect(getHandler).toHaveBeenCalledOnce();
	const [, , state] = getHandler.mock.calls[0]!;
	expect(state.params).toEqual({ id: "5" });
});

test("taking over a message's cleanup through a redirect uses the redirecting route's own state, not the target's", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

	const cleanupFn = vi.fn();
	embedRouter.get("/item/:id", (_router, _interaction, state) => {
		state.session.set("hello");
		return { cleanup: cleanupFn, timeout: 5000 };
	});
	embedRouter.get("/items", () => ({}));
	embedRouter.delete("/item/:id", (_router, _interaction, state) => {
		state.session.delete();
		return { redirect: "/items" };
	});

	await embedRouter.dispatch(mockButtonInteraction(""), "/item/5");
	await embedRouter.dispatch(mockButtonInteraction(""), "/item/5", {
		method: "DELETE",
	});

	expect(cleanupFn).toHaveBeenCalledOnce();
	const [newState] = cleanupFn.mock.calls[0]!;
	expect(newState.path).toBe("/item/5");
	expect(newState.params).toEqual({ id: "5" });
});

test("a route redirecting into another route doesn't preempt its own message's cleanup a second time", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

	const cleanupFn = vi.fn();
	embedRouter.get("/item/:id", (_router, _interaction, state) => {
		state.session.set("hello");
		return { cleanup: cleanupFn, timeout: 5000 };
	});
	embedRouter.get("/items", () => ({}));
	embedRouter.delete("/item/:id", (_router, _interaction, state) => {
		state.session.delete();
		return { redirect: "/items" };
	});

	await embedRouter.dispatch(mockButtonInteraction(""), "/item/5");
	await embedRouter.dispatch(mockButtonInteraction(""), "/item/5", {
		method: "DELETE",
	});

	expect(cleanupFn).toHaveBeenCalledOnce();
});

test("a redirect chain longer than the hop limit throws instead of looping forever", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	embedRouter.get("/a", () => ({ redirect: "/b" }));
	embedRouter.get("/b", () => ({ redirect: "/a" }));

	await expect(
		embedRouter.dispatch(mockButtonInteraction(""), "/a"),
	).rejects.toThrow("Too many redirects");
});

test("a non-GET route handler returning content instead of a redirect throws, even past TypeScript", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	// only reachable by a JS caller (or an `as any`) bypassing the type
	embedRouter.delete("/item/:id", (() => ({
		content: "deleted",
	})) as unknown as Parameters<typeof embedRouter.delete>[1]);

	await expect(
		embedRouter.dispatch(mockButtonInteraction(""), "/item/5", {
			method: "DELETE",
		}),
	).rejects.toThrow("must return a redirect or undefined");
});

test("a second interaction on a busy message is deferred immediately, then runs after the first finishes", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const order: string[] = [];
	let resolveFirst!: () => void;
	const firstStarted = new Promise<void>((resolve) => {
		resolveFirst = resolve;
	});

	embedRouter.get("/first", async () => {
		order.push("first-start");
		resolveFirst();
		await new Promise((resolve) => setTimeout(resolve, 10));
		order.push("first-end");
		return {};
	});
	embedRouter.get("/second", () => {
		order.push("second");
		return {};
	});

	const first = mockButtonInteraction(
		embedRouter.encodePath("/first", { method: "GET" }),
	);
	const second = mockButtonInteraction(
		embedRouter.encodePath("/second", { method: "GET" }),
	);

	client.emit("interactionCreate", first);
	await firstStarted;
	client.emit("interactionCreate", second);

	await vi.waitFor(() =>
		expect(order).toEqual(["first-start", "first-end", "second"]),
	);
	expect(second.deferUpdate).toHaveBeenCalled();
});

test("dispatch merges its query option into the path like encodePath does", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const handler = vi.fn().mockReturnValue({});
	embedRouter.get("/test/:id", handler);

	await embedRouter.dispatch(mockButtonInteraction(""), "/test/2?a=1", {
		query: { b: "2" },
	});

	const [, , state] = handler.mock.calls[0]!;
	expect(state.queryParams.get("a")).toBe("1");
	expect(state.queryParams.get("b")).toBe("2");
});

test("a MODAL route's returned modal is shown instead of replying", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const modal = { customId: "raw", title: "Edit", components: [] };
	embedRouter.modal("/edit/:id", () => modal);

	const interaction = mockButtonInteraction("");
	await embedRouter.dispatch(interaction, "/edit/5", { method: "MODAL" });

	expect(interaction.showModal).toHaveBeenCalledExactlyOnceWith(modal);
	expect(interaction.reply).not.toHaveBeenCalled();
	expect(interaction.update).not.toHaveBeenCalled();
	expect(interaction.deferUpdate).not.toHaveBeenCalled();
});

test("a button encoded with method MODAL routes to the modal route through the listener", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const modal = { customId: "raw", title: "Edit", components: [] };
	embedRouter.modal("/edit/:id", () => modal);

	const interaction = mockButtonInteraction(
		embedRouter.encodePath("/edit/5", { method: "MODAL" }),
	);
	client.emit("interactionCreate", interaction);

	await vi.waitFor(() =>
		expect(interaction.showModal).toHaveBeenCalledExactlyOnceWith(modal),
	);
});

test("a MODAL route can redirect to a GET renderer instead of showing a modal", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	embedRouter.modal("/edit/:id", () => ({ redirect: "/gone" }));
	embedRouter.get("/gone", () => ({ content: "gone" }));

	const interaction = mockButtonInteraction("");
	await embedRouter.dispatch(interaction, "/edit/5", { method: "MODAL" });

	expect(interaction.showModal).not.toHaveBeenCalled();
	expect(interaction.update).toHaveBeenCalledWith({ content: "gone" });
});

test("a MODAL handler returning undefined acks silently without showing a modal", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	embedRouter.modal("/edit", () => undefined);

	const interaction = mockButtonInteraction("");
	await embedRouter.dispatch(interaction, "/edit", { method: "MODAL" });

	expect(interaction.showModal).not.toHaveBeenCalled();
	expect(interaction.deferUpdate).toHaveBeenCalledOnce();
});

test("a MODAL dispatch leaves the message's existing cleanup untouched", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

	const cleanupFn = vi.fn();
	embedRouter.get("/a", (_router, _interaction, state) => {
		state.session.set("hello");
		return { cleanup: cleanupFn, timeout: 5000 };
	});
	embedRouter.modal("/edit", () => ({
		customId: "raw",
		title: "Edit",
		components: [],
	}));
	embedRouter.get("/b", (_router, _interaction, state) => {
		state.session.delete();
		return {};
	});

	await embedRouter.dispatch(mockButtonInteraction(""), "/a");
	await embedRouter.dispatch(mockButtonInteraction(""), "/edit", {
		method: "MODAL",
	});
	expect(cleanupFn).not.toHaveBeenCalled();

	await embedRouter.dispatch(mockButtonInteraction(""), "/b");
	expect(cleanupFn).toHaveBeenCalledOnce();
});

test("a MODAL handler can read the session committed by an earlier render", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

	embedRouter.get("/a", (_router, _interaction, state) => {
		state.session.set("draft");
		return { timeout: 5000 };
	});
	let seenSession: string | undefined;
	embedRouter.modal("/edit", (_router, _interaction, state) => {
		seenSession = state.session.get();
		return undefined;
	});
	let laterSession: string | undefined;
	embedRouter.get("/b", (_router, _interaction, state) => {
		laterSession = state.session.get();
		state.session.delete();
		return {};
	});

	await embedRouter.dispatch(mockButtonInteraction(""), "/a");
	await embedRouter.dispatch(mockButtonInteraction(""), "/edit", {
		method: "MODAL",
	});
	expect(seenSession).toBe("draft");

	// the read didn't consume or commit anything; the session is still there
	await embedRouter.dispatch(mockButtonInteraction(""), "/b");
	expect(laterSession).toBe("draft");
});

test("a MODAL handler writing to the session throws a ConfigError", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

	embedRouter.modal("/edit", (_router, _interaction, state) => {
		(state.session as unknown as { set(session: string): void }).set("nope");
		return undefined;
	});

	await expect(
		embedRouter.dispatch(mockButtonInteraction(""), "/edit", {
			method: "MODAL",
		}),
	).rejects.toThrow("MODAL handlers can not write to the session");
});

test("a MODAL route returning cleanup or timeout throws instead of silently dropping them", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	// only reachable by a JS caller (or an `as any`) bypassing the type
	embedRouter.modal("/edit", (() => ({
		customId: "raw",
		title: "Edit",
		components: [],
		timeout: 5000,
	})) as unknown as Parameters<typeof embedRouter.modal>[1]);

	await expect(
		embedRouter.dispatch(mockButtonInteraction(""), "/edit", {
			method: "MODAL",
		}),
	).rejects.toThrow("must not set cleanup or timeout");
});

test("a modal submission dispatches into an ordinary route with state.fields set", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const handler = vi.fn();
	embedRouter.post("/submit/:id", handler);

	const interaction = mockModalSubmitInteraction(
		embedRouter.encodePath("/submit/7", { method: "POST" }),
	);
	client.emit("interactionCreate", interaction);

	await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
	const [, , state] = handler.mock.calls[0]!;
	expect(state.params).toEqual({ id: "7" });
	expect(state.fields.getTextInputValue()).toBe("typed value");
});

test("state.fields is undefined for dispatches that aren't modal submissions", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const handler = vi.fn().mockReturnValue({});
	embedRouter.get("/test", handler);

	await embedRouter.dispatch(mockButtonInteraction(""), "/test");

	const [, , state] = handler.mock.calls[0]!;
	expect(state.fields).toBeUndefined();
});
