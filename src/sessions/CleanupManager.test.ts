import { Interaction } from "discord.js";
import { expect, test, vi } from "vitest";

import type { State } from "@routing/types";
import { CleanupManager } from "@sessions/CleanupManager";
import { SessionManager } from "@sessions/SessionManager";
import { ConfigError } from "@src/ConfigError";

const mockInteraction = (id: string): Interaction =>
	({ id }) as unknown as Interaction;

const mockState = <Globals = undefined>(
	overrides: Partial<State<Globals, string, undefined>> = {},
): State<Globals, string, undefined> => ({
	path: "/next",
	params: {},
	queryParams: new URLSearchParams(),
	globals: undefined as Globals,
	locals: undefined,
	session: new SessionManager<string>().open(
		mockInteraction("next"),
		undefined,
	),
	...overrides,
});

test("has() reflects whether a message has a registered cleanup", () => {
	const manager = new CleanupManager<undefined, string, undefined>(
		new SessionManager(),
		vi.fn(),
	);

	expect(manager.has("msg1")).toBe(false);
	manager.register("msg1", {
		interaction: mockInteraction("int1"),
		cleanupFn: undefined,
		applyFn: undefined,
		timeout: 10_000,
	});
	expect(manager.has("msg1")).toBe(true);
});

test("run() invokes cleanupFn with the new state", async () => {
	const manager = new CleanupManager<undefined, string, undefined>(
		new SessionManager(),
		vi.fn(),
	);
	const cleanupFn = vi.fn();
	manager.register("msg1", {
		interaction: mockInteraction("int1"),
		cleanupFn,
		applyFn: undefined,
		timeout: 10_000,
	});

	const newState = mockState();
	await manager.run("msg1", newState);

	expect(cleanupFn).toHaveBeenCalledExactlyOnceWith(newState);
	expect(manager.has("msg1")).toBe(false);
});

test("run() with no new state means a real timeout", async () => {
	const manager = new CleanupManager<undefined, string, undefined>(
		new SessionManager(),
		vi.fn(),
	);
	const cleanupFn = vi.fn();
	manager.register("msg1", {
		interaction: mockInteraction("int1"),
		cleanupFn,
		applyFn: undefined,
		timeout: 10_000,
	});

	await manager.run("msg1", undefined);

	expect(cleanupFn).toHaveBeenCalledExactlyOnceWith(undefined);
});

test("registering a new cleanup cancels the previous one's timer without re-running it", () => {
	const manager = new CleanupManager<undefined, string, undefined>(
		new SessionManager(),
		vi.fn(),
	);
	const oldCleanupFn = vi.fn();
	manager.register("msg1", {
		interaction: mockInteraction("int1"),
		cleanupFn: oldCleanupFn,
		applyFn: undefined,
		timeout: 10_000,
	});

	const newCleanupFn = vi.fn();
	manager.register("msg1", {
		interaction: mockInteraction("int2"),
		cleanupFn: newCleanupFn,
		applyFn: undefined,
		timeout: 10_000,
	});

	// registration doesn't run either handler itself -- the caller is
	// responsible for running the old one (with the new state) beforehand
	expect(oldCleanupFn).not.toHaveBeenCalled();
	expect(newCleanupFn).not.toHaveBeenCalled();
	expect(manager.has("msg1")).toBe(true);
});

test("a real timeout deletes the message's session; a new state does not", async () => {
	const sessions = new SessionManager<string>();
	sessions.open(mockInteraction("setup"), undefined).set("hello");
	sessions.commit(mockInteraction("setup"), "msg1");

	const manager = new CleanupManager<undefined, string, undefined>(
		sessions,
		vi.fn(),
	);
	manager.register("msg1", {
		interaction: mockInteraction("int1"),
		cleanupFn: undefined,
		applyFn: undefined,
		timeout: 10_000,
	});
	await manager.run("msg1", mockState());
	expect(sessions.open(mockInteraction("check1"), "msg1").has()).toBe(true);

	manager.register("msg1", {
		interaction: mockInteraction("int2"),
		cleanupFn: undefined,
		applyFn: undefined,
		timeout: 10_000,
	});
	await manager.run("msg1", undefined);
	expect(sessions.open(mockInteraction("check2"), "msg1").has()).toBe(false);
});

test("applyFn only runs on a real timeout, and only if cleanupFn returned a result", async () => {
	const manager = new CleanupManager<undefined, string, undefined>(
		new SessionManager(),
		vi.fn(),
	);
	const applyFn = vi.fn().mockResolvedValue(undefined);

	manager.register("msg1", {
		interaction: mockInteraction("int1"),
		cleanupFn: () => ({ content: "done" }),
		applyFn,
		timeout: 10_000,
	});
	await manager.run("msg1", mockState());
	expect(applyFn).not.toHaveBeenCalled();

	manager.register("msg2", {
		interaction: mockInteraction("int2"),
		cleanupFn: () => ({ content: "done" }),
		applyFn,
		timeout: 10_000,
	});
	await manager.run("msg2", undefined);
	expect(applyFn).toHaveBeenCalledWith({ content: "done" });
});

test("ConfigError from cleanupFn propagates instead of going through onError", async () => {
	const onError = vi.fn();
	const manager = new CleanupManager<undefined, string, undefined>(
		new SessionManager(),
		onError,
	);
	manager.register("msg1", {
		interaction: mockInteraction("int1"),
		cleanupFn: () => {
			throw new ConfigError("boom");
		},
		applyFn: undefined,
		timeout: 10_000,
	});

	await expect(manager.run("msg1", mockState())).rejects.toThrow(ConfigError);
	expect(onError).not.toHaveBeenCalled();
});

test("a ConfigError thrown when a real timeout fires is reported via onError instead of becoming an unhandled rejection", async () => {
	vi.useFakeTimers();
	try {
		const onError = vi.fn();
		const manager = new CleanupManager<undefined, string, undefined>(
			new SessionManager(),
			onError,
		);
		const interaction = mockInteraction("int1");
		manager.register("msg1", {
			interaction,
			cleanupFn: () => {
				throw new ConfigError("boom");
			},
			applyFn: undefined,
			timeout: 1000,
		});

		// unlike run() called directly (above), nothing awaits register()'s own
		// timer -- a ConfigError escaping from here must not become an
		// unhandled rejection
		await vi.advanceTimersByTimeAsync(1000);

		expect(onError).toHaveBeenCalledExactlyOnceWith(
			expect.any(ConfigError),
			interaction,
		);
	} finally {
		vi.useRealTimers();
	}
});

test("a regular error from cleanupFn is reported via onError instead of rejecting", async () => {
	const onError = vi.fn();
	const manager = new CleanupManager<undefined, string, undefined>(
		new SessionManager(),
		onError,
	);
	const interaction = mockInteraction("int1");
	manager.register("msg1", {
		interaction,
		cleanupFn: () => {
			throw new Error("regular failure");
		},
		applyFn: undefined,
		timeout: 10_000,
	});

	await expect(manager.run("msg1", mockState())).resolves.toBeUndefined();
	expect(onError).toHaveBeenCalledWith(expect.any(Error), interaction);
});

test("an applyFn rejection is reported via onError", async () => {
	const onError = vi.fn();
	const manager = new CleanupManager<undefined, string, undefined>(
		new SessionManager(),
		onError,
	);
	const interaction = mockInteraction("int1");
	manager.register("msg1", {
		interaction,
		cleanupFn: () => ({ content: "done" }),
		applyFn: vi.fn().mockRejectedValue(new Error("apply failed")),
		timeout: 10_000,
	});

	await manager.run("msg1", undefined);
	expect(onError).toHaveBeenCalledWith(expect.any(Error), interaction);
});
