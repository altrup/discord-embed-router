import EventEmitter from "node:events";

import {
	ButtonInteraction,
	Client,
	MessageFlags,
	ModalSubmitInteraction,
} from "discord.js";
import { Path, Token } from "path-to-regexp";
import { expect, test, vi } from "vitest";

import { Encoder } from "@encoding/Encoder";
import { HashEncoder } from "@encoding/HashEncoder";
import { EmbedRouter } from "@routing/EmbedRouter";
import { Method, RouteOptionsWithMethod } from "@routing/types";
import { ConfigError } from "@src/ConfigError";
import { FLAGS_QUERY_PARAM, KEY_QUERY_PARAM } from "@src/consts";

const mockClient = (): Client => new EventEmitter() as unknown as Client;

// real interactions always have a unique snowflake id, which SessionManager
// keys its state by -- give every mock one so tests don't collide on it
let nextInteractionId = 1;

const mockButtonInteraction = (
	customId: string,
	overrides: Partial<ButtonInteraction> = {},
): ButtonInteraction => {
	return {
		id: `interaction-${nextInteractionId++}`,
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

test("destroy() releases a router's identifier for reuse without a collision warning", () => {
	const client = mockClient();
	const warningSpy = vi
		.spyOn(process, "emitWarning")
		.mockImplementation(() => {});

	const first = new EmbedRouter(client, { name: "destroy-test" });
	first.destroy();
	warningSpy.mockClear();
	new EmbedRouter(client, { name: "destroy-test" });

	expect(warningSpy).not.toHaveBeenCalled();
});

test("destroy() clears registered routes and rejects further dispatch", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);
	embedRouter.get("/test", () => ({}));

	embedRouter.destroy();

	await expect(
		embedRouter.dispatch(mockButtonInteraction(""), "/test"),
	).rejects.toThrow("has been destroyed");
});

test("destroy() is idempotent", () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	embedRouter.destroy();
	expect(() => embedRouter.destroy()).not.toThrow();
});

test("methods other than destroy() throw after destroy()", () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	embedRouter.destroy();

	expect(() => embedRouter.get("/test", () => ({}))).toThrow(
		"has been destroyed",
	);
	expect(() => embedRouter.setClient(client)).toThrow("has been destroyed");
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

	const handler = vi.fn().mockReturnValue({ redirect: "/test/3" });
	const noPrefixButtonInteraction = mockButtonInteraction(
		embedRouter.encodePath("/test/2", { idPrefix: "", method: "DELETE" }),
	);
	const prefixButtonInteraction = mockButtonInteraction(
		embedRouter.encodePath("/test/3", { method: "DELETE" }),
	);

	embedRouter.get("/test/:id", () => ({}));
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
	).rejects.toMatchObject({
		cause: {
			message: expect.stringContaining(
				"Timeout is required for components using cleanups or sessions",
			),
		},
	});
});

test("an error thrown by a handler is wrapped with the method and path when reported via routeError", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);
	const original = new Error("boom");

	embedRouter.get("/broken/:id", () => {
		throw original;
	});

	const onError = vi.fn();
	embedRouter.onError(onError);

	client.emit(
		"interactionCreate",
		mockButtonInteraction(
			embedRouter.encodePath("/broken/5", { method: "GET" }),
		),
	);

	await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());

	const [error] = onError.mock.calls[0]!;
	expect(error.message).toBe("Error while handling GET /broken/5");
	expect(error.cause).toBe(original);
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

test("a cleanupFn's session write through its own closed-over state.session is persisted when a new interaction takes over", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

	embedRouter.get("/a", (_router, _interaction, state) => {
		state.session.set("in progress");
		return {
			cleanup: () => {
				state.session.set("final value");
				return undefined;
			},
			timeout: 1000,
		};
	});

	await embedRouter.dispatch(mockButtonInteraction(""), "/a");

	let seenSession: string | undefined;
	embedRouter.get("/read", (_router, _interaction, state) => {
		seenSession = state.session.get();
		state.session.delete();
		return {};
	});
	await embedRouter.dispatch(mockButtonInteraction(""), "/read");
	expect(seenSession).toBe("final value");
});

test("a real timeout drops whatever cleanupFn wrote through its own closed-over state.session", async () => {
	vi.useFakeTimers();
	try {
		const client = mockClient();
		const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

		embedRouter.get("/a", (_router, _interaction, state) => {
			state.session.set("in progress");
			return {
				cleanup: () => {
					state.session.set("too late");
					return undefined;
				},
				timeout: 1000,
			};
		});

		await embedRouter.dispatch(mockButtonInteraction(""), "/a");
		await vi.advanceTimersByTimeAsync(1000);

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

test("a handler's own setTimeout writing to state.session throws once no cleanup/timeout was registered to keep it open", async () => {
	vi.useFakeTimers();
	try {
		const client = mockClient();
		const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

		let caught: unknown;
		embedRouter.get("/a", (_router, _interaction, state) => {
			// no cleanup/timeout returned, so dispatch() discards this handle
			// as soon as the handler returns
			setTimeout(() => {
				try {
					state.session.set("too late");
				} catch (e) {
					caught = e;
				}
			}, 500);
			return {};
		});

		await embedRouter.dispatch(mockButtonInteraction(""), "/a");
		await vi.advanceTimersByTimeAsync(500);

		expect(caught).toBeInstanceOf(ConfigError);
		expect((caught as Error).message).toContain(
			"already been committed or discarded",
		);
	} finally {
		vi.useRealTimers();
	}
});

test("a handler's own setTimeout writing to state.session works if before cleanup", async () => {
	vi.useFakeTimers();
	try {
		const client = mockClient();
		const embedRouter = new EmbedRouter<undefined, string, undefined>(client);

		embedRouter.get("/a", (_router, _interaction, state) => {
			// no cleanup/timeout returned, so dispatch() discards this handle
			// as soon as the handler returns
			const timeout = setTimeout(() => {
				state.session.set("allowed");
			}, 500);
			return {
				cleanup: () => void clearTimeout(timeout),
				timeout: 1000,
			};
		});

		await embedRouter.dispatch(mockButtonInteraction(""), "/a");
		await vi.advanceTimersByTimeAsync(500);

		let seenSession: string | undefined = "not read yet";
		embedRouter.get("/read", (_router, _interaction, state) => {
			seenSession = state.session.get();
			return {
				timeout: 1000,
			};
		});
		await embedRouter.dispatch(mockButtonInteraction(""), "/read");
		expect(seenSession).toBe("allowed");
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

test("a redirect's queryParams option merges into the target path like dispatch's does", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const getHandler = vi.fn().mockReturnValue({ content: "item" });
	embedRouter.get("/item", getHandler);
	embedRouter.delete("/item", () => ({
		redirect: "/item?a=1",
		queryParams: { b: "2" },
	}));

	await embedRouter.dispatch(mockButtonInteraction(""), "/item", {
		method: "DELETE",
	});

	const [, , state] = getHandler.mock.calls[0]!;
	expect(state.queryParams.get("a")).toBe("1");
	expect(state.queryParams.get("b")).toBe("2");
});

test("taking over a message's cleanup through a redirect uses the target route's state, not the redirecting route's", async () => {
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
	expect(newState.path).toBe("/items");
	expect(newState.params).toEqual({});
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
	).rejects.toMatchObject({
		cause: { message: expect.stringContaining("Too many redirects") },
	});
});

test("a redirect targeting a non-GET/MODAL method throws, even past TypeScript", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	// only reachable by a JS caller (or an `as any`) bypassing the type
	embedRouter.get("/a", (() => ({
		redirect: "/a",
		method: "POST",
	})) as unknown as Parameters<typeof embedRouter.get>[1]);
	embedRouter.post("/a", () => {
		throw new Error("should never be reached");
	});

	await expect(
		embedRouter.dispatch(mockButtonInteraction(""), "/a"),
	).rejects.toMatchObject({
		cause: {
			message: expect.stringContaining(
				'A redirect can only target GET or MODAL, not "POST"',
			),
		},
	});
});

test("dispatch() throws if called on an interaction that's still being dispatched", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);
	const interaction = mockButtonInteraction("");

	let reentrantResult: unknown;
	embedRouter.get("/a", () => {
		reentrantResult = embedRouter
			.dispatch(interaction, "/a")
			.catch((e: unknown) => e);
		return { content: "ok" };
	});

	await embedRouter.dispatch(interaction, "/a");
	await expect(reentrantResult).resolves.toMatchObject({
		cause: { message: expect.stringContaining("still being dispatched") },
	});
});

test("a handler's own setTimeout calling dispatch() on the same interaction works once the original dispatch has settled", async () => {
	vi.useFakeTimers();
	try {
		const client = mockClient();
		const embedRouter = new EmbedRouter(client);
		const interaction = mockButtonInteraction("");

		const handler = vi.fn().mockImplementation(() => {
			setTimeout(() => void embedRouter.dispatch(interaction, "/a"), 500);
			return { content: "ok" };
		});
		embedRouter.get("/a", handler);

		await embedRouter.dispatch(interaction, "/a");
		await vi.advanceTimersByTimeAsync(500);

		expect(handler).toHaveBeenCalledTimes(2);
	} finally {
		vi.useRealTimers();
	}
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
	).rejects.toMatchObject({
		cause: {
			message: expect.stringContaining(
				"Non-GET route handlers must return a redirect",
			),
		},
	});
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

test("dispatch merges its queryParams option into the path like encodePath does", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const handler = vi.fn().mockReturnValue({});
	embedRouter.get("/test/:id", handler);

	await embedRouter.dispatch(mockButtonInteraction(""), "/test/2?a=1", {
		queryParams: { b: "2" },
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

test("dispatch accepts a MODAL method, since it's the only method-accepting API that does", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const modal = { customId: "raw", title: "Edit", components: [] };
	embedRouter.modal("/edit/:id", () => modal);

	await expect(
		embedRouter.dispatch(mockButtonInteraction(""), "/edit/5", {
			method: "MODAL",
		}),
	).resolves.toBeUndefined();
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

test("a non-GET route can redirect to a MODAL route to show a modal instead of rendering", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	embedRouter.post("/edit", () => ({
		redirect: "/edit",
		method: "MODAL",
	}));
	embedRouter.modal("/edit", () => ({
		title: "edit",
		customId: "edit",
		components: [],
	}));

	const interaction = mockButtonInteraction("");
	await embedRouter.dispatch(interaction, "/edit", { method: "POST" });

	expect(interaction.showModal).toHaveBeenCalledOnce();
});

test("a modal submission can't be routed into a MODAL route, since it can't itself show a modal", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	embedRouter.modal("/step2", () => ({
		title: "step 2",
		customId: "step2",
		components: [],
	}));

	const interaction = mockModalSubmitInteraction("");

	await expect(
		embedRouter.dispatch(interaction, "/step2", { method: "MODAL" }),
	).rejects.toMatchObject({
		cause: {
			message: expect.stringContaining("aren't modal submissions themselves"),
		},
	});
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
	).rejects.toMatchObject({
		cause: {
			message: expect.stringContaining("does not support cleanup or timeout"),
		},
	});
});

test("a modal submission dispatches into an ordinary route with state.fields set", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const handler = vi.fn().mockReturnValue({ redirect: "/submit/7" });
	embedRouter.get("/submit/:id", () => ({}));
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

test("a modal's carried flags are applied when its submission creates the reply", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	embedRouter.post("/submit", () => ({ redirect: "/done" }));
	const getHandler = vi.fn().mockReturnValue({ content: "done" });
	embedRouter.get("/done", getHandler);

	// modal submits shown from a slash command have no message
	const interaction = mockModalSubmitInteraction(
		embedRouter.encodePath("/submit", {
			method: "POST",
			flags: MessageFlags.Ephemeral,
		}),
		{ message: null } as unknown as Partial<ModalSubmitInteraction>,
	);
	client.emit("interactionCreate", interaction);

	await vi.waitFor(() =>
		expect(interaction.reply).toHaveBeenCalledExactlyOnceWith({
			content: "done",
			flags: MessageFlags.Ephemeral,
		}),
	);
	// the reserved flags param never reaches the handler
	const [, , state] = getHandler.mock.calls[0]!;
	expect([...state.queryParams.keys()]).toEqual([]);
});

test("a two-digit carried flags value round-trips through the customId", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	embedRouter.post("/submit", () => ({ redirect: "/done" }));
	embedRouter.get("/done", () => ({ content: "done" }));

	const allReplyFlags = [
		MessageFlags.Ephemeral,
		MessageFlags.SuppressEmbeds,
		MessageFlags.SuppressNotifications,
		MessageFlags.IsComponentsV2,
	] as const;
	const interaction = mockModalSubmitInteraction(
		embedRouter.encodePath("/submit", {
			method: "POST",
			flags: allReplyFlags,
		}),
		{ message: null } as unknown as Partial<ModalSubmitInteraction>,
	);
	client.emit("interactionCreate", interaction);

	await vi.waitFor(() =>
		expect(interaction.reply).toHaveBeenCalledExactlyOnceWith({
			content: "done",
			flags: allReplyFlags.reduce((bits, flag) => bits | flag, 0),
		}),
	);
});

test("carried flags are ignored when the submission edits the message its modal was launched from", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	embedRouter.post("/submit", () => ({ redirect: "/done" }));
	embedRouter.get("/done", () => ({ content: "done" }));

	const interaction = mockModalSubmitInteraction(
		embedRouter.encodePath("/submit", {
			method: "POST",
			flags: MessageFlags.Ephemeral,
		}),
	);
	client.emit("interactionCreate", interaction);

	// update only exists on message-launched modal submits; the mock always
	// provides it
	const { update } = interaction as unknown as { update: () => void };
	await vi.waitFor(() =>
		expect(update).toHaveBeenCalledExactlyOnceWith({ content: "done" }),
	);
	expect(interaction.reply).not.toHaveBeenCalled();
});

test("carried flags cost one param char plus one digit per PUA_RANGE power", () => {
	const embedRouter = new EmbedRouter(mockClient());

	const plain = embedRouter.encodePath("/submit", { method: "POST" });
	const flagged = embedRouter.encodePath("/submit", {
		method: "POST",
		flags: MessageFlags.Ephemeral,
	});

	// "?" + the one-char flags param + "=" + the one-digit value
	expect(flagged.length).toBe(plain.length + 4);
});

test("encodePath rejects queryParams that use the reserved flags param", () => {
	const embedRouter = new EmbedRouter(mockClient());

	expect(() =>
		embedRouter.encodePath("/test", {
			method: "GET",
			queryParams: { [FLAGS_QUERY_PARAM]: "x" },
		}),
	).toThrow(ConfigError);
});

test("dispatch with flags on a MODAL method throws, even past TypeScript", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	embedRouter.modal("/edit", () => ({
		customId: "raw",
		title: "Edit",
		components: [],
	}));

	await expect(
		embedRouter.dispatch(mockButtonInteraction(""), "/edit", {
			method: "MODAL",
			// @ts-expect-error flags are disallowed with MODAL dispatches
			flags: [MessageFlags.Ephemeral],
		}),
	).rejects.toMatchObject({
		cause: {
			message: expect.stringContaining(
				"You can not set flags when showing a modal",
			),
		},
	});
});

test("componentBuilder params are registered automatically, giving them a compact encoding without an explicit route", () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const encoded = embedRouter.encodePath("/item/:ts", { method: "GET" });

	expect(encoded).not.toContain(":ts");
});

test("a custom Encoder subclass passed to the constructor is used instead of the default HashEncoder", () => {
	class RecordingEncoder extends Encoder {
		#inner = new HashEncoder();
		public registeredPaths: Path[] = [];

		public registerPath<P extends Path>(path: P) {
			this.registeredPaths.push(path);
			this.#inner.registerPath(path);
		}

		public registerToken(token: Token) {
			this.#inner.registerToken(token);
		}

		public encodePath<
			AllowEmptyMethod extends boolean = false,
			P extends Path = Path,
		>(
			path: P,
			options: RouteOptionsWithMethod<true, AllowEmptyMethod> & {
				idPrefix: string;
			},
		) {
			return this.#inner.encodePath(path, options);
		}

		public decodePath<P extends Path>(
			path: P,
			options: { idPrefix: string; allowEmptyMethod?: false },
		): { method: Method; path: string } | false;
		public decodePath<P extends Path>(
			path: P,
			options: { idPrefix: string; allowEmptyMethod: true },
		): { method: Method | ""; path: string } | false;
		public decodePath<P extends Path>(
			path: P,
			options: { idPrefix: string; allowEmptyMethod?: boolean },
		): { method: Method | ""; path: string } | false {
			return this.#inner.decodePath(
				path,
				options as { idPrefix: string; allowEmptyMethod: true },
			);
		}
	}

	const client = mockClient();
	const encoder = new RecordingEncoder();
	const embedRouter = new EmbedRouter(client, { encoder });

	embedRouter.get("/custom/:id", () => ({}));

	expect(encoder.registeredPaths).toContain("/custom/:id");
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

test("route() registers every provided method handler at one path", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const getHandler = vi.fn().mockReturnValue({ content: "counter" });
	const modalHandler = vi.fn().mockReturnValue(undefined);
	embedRouter.route("/counter", {
		get: getHandler,
		post: () => ({ redirect: "/counter" }),
		modal: modalHandler,
	});

	// the POST redirecting into a render proves both handlers were registered
	await embedRouter.dispatch(mockButtonInteraction(""), "/counter", {
		method: "POST",
	});
	expect(getHandler).toHaveBeenCalledOnce();

	await embedRouter.dispatch(mockButtonInteraction(""), "/counter", {
		method: "MODAL",
	});
	expect(modalHandler).toHaveBeenCalledOnce();
});

test("route() with no handlers throws a ConfigError", () => {
	const embedRouter = new EmbedRouter(mockClient());

	expect(() => embedRouter.route("/empty", {})).toThrow(ConfigError);
});

test("route() rejects unknown method keys at the type level and registers nothing at runtime", () => {
	const embedRouter = new EmbedRouter(mockClient());

	expect(() =>
		// @ts-expect-error "gte" is not a method key
		embedRouter.route("/typo", { gte: () => ({ content: "" }) }),
	).toThrow(ConfigError);
});

test("encodePath's key option disambiguates otherwise identical customIds", () => {
	const embedRouter = new EmbedRouter(mockClient());

	const plain = embedRouter.encodePath("/same", { method: "GET" });
	const a = embedRouter.encodePath("/same", { method: "GET", key: "a" });
	const b = embedRouter.encodePath("/same", { method: "GET", key: "b" });

	expect(a).not.toBe(plain);
	expect(a).not.toBe(b);
	// same inputs stay deterministic across builds
	expect(embedRouter.encodePath("/same", { method: "GET", key: "a" })).toBe(a);
});

test("a key costs only itself plus three chars of customId budget", () => {
	const embedRouter = new EmbedRouter(mockClient());

	const plain = embedRouter.encodePath("/same", { method: "GET" });
	const keyed = embedRouter.encodePath("/same", { method: "GET", key: "ab" });

	// "?" + the one-char key param + "=" + the key itself
	expect(keyed.length).toBe(plain.length + 3 + "ab".length);
});

test("a keyed component routes normally and its handler never sees the key", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const handler = vi.fn().mockReturnValue({});
	embedRouter.get("/test/:id", handler);

	client.emit(
		"interactionCreate",
		mockButtonInteraction(
			embedRouter.encodePath("/test/7", {
				method: "GET",
				queryParams: { test: "3" },
				key: "top",
			}),
		),
	);

	await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
	const [, , state] = handler.mock.calls[0]!;
	expect(state.params).toEqual({ id: "7" });
	expect([...state.queryParams.keys()]).toEqual(["test"]);
});

test("encodePath rejects queryParams that use the reserved key param", () => {
	const embedRouter = new EmbedRouter(mockClient());

	expect(() =>
		embedRouter.encodePath("/test", {
			method: "GET",
			queryParams: { [KEY_QUERY_PARAM]: "x" },
		}),
	).toThrow(ConfigError);
});

test("route() throws a ConfigError naming any unknown handler key, even alongside valid ones", () => {
	const embedRouter = new EmbedRouter(mockClient());

	expect(() =>
		embedRouter.route("/typo", {
			get: () => ({ content: "" }),
			// @ts-expect-error "psot" is not a method key
			psot: () => ({ redirect: "/typo" }),
		}),
	).toThrow(/psot/);
});

test("route is emitted before the handler runs", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);
	const order: string[] = [];

	embedRouter.get("/test", () => {
		order.push("handler");
		return {};
	});
	embedRouter.on("route", () => order.push("event"));

	await embedRouter.dispatch(mockButtonInteraction(""), "/test");

	expect(order).toEqual(["event", "handler"]);
});

test("route carries the method, matched pattern, and 'interaction' trigger for a component interaction", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);
	embedRouter.get("/thing/:id", () => ({}));

	const onRoute = vi.fn();
	embedRouter.on("route", onRoute);

	const interaction = mockButtonInteraction(
		embedRouter.encodePath("/thing/5", { method: "GET" }),
	);
	client.emit("interactionCreate", interaction);

	await vi.waitFor(() => expect(onRoute).toHaveBeenCalledOnce());
	expect(onRoute).toHaveBeenCalledWith(interaction, {
		method: "GET",
		path: "/thing/:id",
		trigger: "interaction",
	});
});

test("route carries the 'dispatch' trigger for dispatch() calls", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);
	embedRouter.get("/thing/:id", () => ({}));

	const onRoute = vi.fn();
	embedRouter.on("route", onRoute);

	const interaction = mockButtonInteraction("");
	await embedRouter.dispatch(interaction, "/thing/5");

	expect(onRoute).toHaveBeenCalledExactlyOnceWith(interaction, {
		method: "GET",
		path: "/thing/:id",
		trigger: "dispatch",
	});
});

test("a redirect hop after an interaction POST is emitted with the 'redirect' trigger", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);
	embedRouter.post("/inc", () => ({ redirect: "/page" }));
	embedRouter.get("/page", () => ({}));

	const onRoute = vi.fn();
	embedRouter.on("route", onRoute);

	const interaction = mockButtonInteraction(
		embedRouter.encodePath("/inc", { method: "POST" }),
	);
	client.emit("interactionCreate", interaction);

	await vi.waitFor(() => expect(onRoute).toHaveBeenCalledTimes(2));
	expect(onRoute.mock.calls).toEqual([
		[interaction, { method: "POST", path: "/inc", trigger: "interaction" }],
		[interaction, { method: "GET", path: "/page", trigger: "redirect" }],
	]);
});

test("a redirect hop after a dispatch is 'redirect'; only the first hop is 'dispatch'", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);
	embedRouter.post("/inc", () => ({ redirect: "/page" }));
	embedRouter.get("/page", () => ({}));

	const onRoute = vi.fn();
	embedRouter.on("route", onRoute);

	const interaction = mockButtonInteraction("");
	await embedRouter.dispatch(interaction, "/inc", { method: "POST" });

	expect(onRoute.mock.calls).toEqual([
		[interaction, { method: "POST", path: "/inc", trigger: "dispatch" }],
		[interaction, { method: "GET", path: "/page", trigger: "redirect" }],
	]);
});

test("route reports the specific pattern that matched in a multi-path registration", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);
	embedRouter.get(["/filter", "/filter/:scope"], () => ({}));

	const onRoute = vi.fn();
	embedRouter.on("route", onRoute);

	await embedRouter.dispatch(mockButtonInteraction(""), "/filter/all");

	expect(onRoute).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
		method: "GET",
		path: "/filter/:scope",
		trigger: "dispatch",
	});
});

test("route()-registered handlers emit route identically to method-registered ones", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);
	embedRouter.route("/combo", {
		get: () => ({}),
		post: () => ({ redirect: "/combo" }),
	});

	const onRoute = vi.fn();
	embedRouter.on("route", onRoute);

	const interaction = mockButtonInteraction("");
	await embedRouter.dispatch(interaction, "/combo", { method: "POST" });

	expect(onRoute.mock.calls).toEqual([
		[interaction, { method: "POST", path: "/combo", trigger: "dispatch" }],
		[interaction, { method: "GET", path: "/combo", trigger: "redirect" }],
	]);
});

test("a throwing route listener is reported via routeError and does not prevent the handler from running", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	const handler = vi.fn().mockReturnValue({});
	embedRouter.get("/test", handler);

	const listenerError = new Error("listener boom");
	embedRouter.on("route", () => {
		throw listenerError;
	});
	const onError = vi.fn();
	embedRouter.onError(onError);

	await embedRouter.dispatch(mockButtonInteraction(""), "/test");

	expect(handler).toHaveBeenCalledOnce();
	expect(onError).toHaveBeenCalledExactlyOnceWith(
		listenerError,
		expect.anything(),
		{ method: "GET", path: "/test", trigger: "dispatch" },
	);
});

test("routeError carries the RouteInfo of the route whose handler threw", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);

	embedRouter.get("/broken/:id", () => {
		throw new Error("boom");
	});

	const onError = vi.fn();
	embedRouter.onError(onError);

	client.emit(
		"interactionCreate",
		mockButtonInteraction(
			embedRouter.encodePath("/broken/5", { method: "GET" }),
		),
	);

	await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
	const [, , info] = onError.mock.calls[0]!;
	expect(info).toEqual({
		method: "GET",
		path: "/broken/:id",
		trigger: "interaction",
	});
});

test("routeError has no RouteInfo for a failure before any route matched", async () => {
	const client = mockClient();
	const embedRouter = new EmbedRouter(client);
	embedRouter.get("/test", () => ({}));

	const onError = vi.fn();
	embedRouter.onError(onError);

	// prefixed but undecodable customId never reaches a handler
	client.emit(
		"interactionCreate",
		mockButtonInteraction(`${embedRouter.idPrefix}garbage`),
	);

	await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
	const [error, , info] = onError.mock.calls[0]!;
	expect(error.message).toContain("Invalid component");
	expect(info).toBeUndefined();
});
