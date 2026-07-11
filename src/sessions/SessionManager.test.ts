import { Interaction } from "discord.js";
import { expect, test } from "vitest";

import { SessionManager } from "@sessions/SessionManager";
import { ConfigError } from "@src/ConfigError";

const mockInteraction = (id: string): Interaction =>
	({ id }) as unknown as Interaction;

test("open() with no existing message session starts empty", () => {
	const sessions = new SessionManager<{ count: number }>();
	const handle = sessions.open(mockInteraction("int1"), "msg1");

	expect(handle.has()).toBe(false);
	expect(handle.get()).toBeUndefined();
});

test("set() then get() round-trips a clone, not the original reference", () => {
	const sessions = new SessionManager<{ count: number }>();
	const handle = sessions.open(mockInteraction("int1"), undefined);

	const original = { count: 1 };
	handle.set(original);

	const read = handle.get();
	expect(read).toStrictEqual(original);
	expect(read).not.toBe(original);

	// mutating the read value must not affect what's stored
	read!.count = 999;
	expect(handle.get()).toStrictEqual({ count: 1 });
});

test("open() seeds the working copy from an existing committed session", () => {
	const sessions = new SessionManager<{ count: number }>();

	const first = sessions.open(mockInteraction("int1"), "msg1");
	first.set({ count: 5 });
	sessions.commit(mockInteraction("int1"), "msg1");

	const second = sessions.open(mockInteraction("int2"), "msg1");
	expect(second.has()).toBe(true);
	expect(second.get()).toStrictEqual({ count: 5 });
});

test("commit() moves the working copy into the durable, message-keyed store", () => {
	const sessions = new SessionManager<{ count: number }>();
	const interaction = mockInteraction("int1");

	const handle = sessions.open(interaction, undefined);
	handle.set({ count: 2 });
	sessions.commit(interaction, "msg1");

	expect(sessions.open(mockInteraction("int2"), "msg1").get()).toStrictEqual({
		count: 2,
	});
});

test("commit() with nothing staged clears any existing durable session", () => {
	const sessions = new SessionManager<{ count: number }>();

	sessions.open(mockInteraction("int1"), "msg1").set({ count: 1 });
	sessions.commit(mockInteraction("int1"), "msg1");
	expect(sessions.open(mockInteraction("int2"), "msg1").has()).toBe(true);

	// a fresh interaction with no message yet, so nothing gets seeded/set
	const unrelated = mockInteraction("int3");
	sessions.open(unrelated, undefined);
	sessions.commit(unrelated, "msg1");

	expect(sessions.open(mockInteraction("int4"), "msg1").has()).toBe(false);
});

test("persist() writes the working copy into the durable store without closing the handle", () => {
	const sessions = new SessionManager<{ count: number }>();
	const interaction = mockInteraction("int1");

	const handle = sessions.open(interaction, undefined);
	handle.set({ count: 7 });
	sessions.persist(interaction, "msg1");

	expect(sessions.open(mockInteraction("int2"), "msg1").get()).toStrictEqual({
		count: 7,
	});
	// the handle is still open, unlike after commit()
	expect(() => handle.set({ count: 8 })).not.toThrow();
});

test("persist() with nothing staged clears any existing durable session", () => {
	const sessions = new SessionManager<{ count: number }>();

	sessions.open(mockInteraction("int1"), "msg1").set({ count: 1 });
	sessions.commit(mockInteraction("int1"), "msg1");

	const unrelated = mockInteraction("int2");
	sessions.open(unrelated, undefined);
	sessions.persist(unrelated, "msg1");

	expect(sessions.open(mockInteraction("int3"), "msg1").has()).toBe(false);
});

test("discard() drops the working copy without touching the durable store", () => {
	const sessions = new SessionManager<{ count: number }>();
	const interaction = mockInteraction("int1");

	sessions.open(interaction, "msg1").set({ count: 3 });
	sessions.discard(interaction);
	sessions.commit(interaction, "msg1");

	expect(sessions.open(mockInteraction("int2"), "msg1").has()).toBe(false);
});

test("using a handle after commit() throws instead of silently leaking a write or reading stale data", () => {
	const sessions = new SessionManager<{ count: number }>();
	const interaction = mockInteraction("int1");

	const handle = sessions.open(interaction, undefined);
	sessions.commit(interaction, "msg1");

	// e.g. a caller's own setTimeout that outlives the dispatch that opened
	// this handle -- must fail loudly, not resurrect a #staging entry that
	// nothing will ever commit or clean up, or read data that's now stale
	expect(() => handle.get()).toThrow(ConfigError);
	expect(() => handle.has()).toThrow(ConfigError);
	expect(() => handle.set({ count: 1 })).toThrow(ConfigError);
	expect(() => handle.delete()).toThrow(ConfigError);
});

test("using a handle after discard() throws", () => {
	const sessions = new SessionManager<{ count: number }>();
	const interaction = mockInteraction("int1");

	const handle = sessions.open(interaction, undefined);
	sessions.discard(interaction);

	expect(() => handle.get()).toThrow(ConfigError);
	expect(() => handle.set({ count: 1 })).toThrow(ConfigError);
});

test("deleteForMessage() clears a durable session", () => {
	const sessions = new SessionManager<{ count: number }>();
	const interaction = mockInteraction("int1");

	sessions.open(interaction, undefined).set({ count: 4 });
	sessions.commit(interaction, "msg1");
	expect(sessions.open(mockInteraction("int2"), "msg1").has()).toBe(true);

	sessions.deleteForMessage("msg1");
	expect(sessions.open(mockInteraction("int3"), "msg1").has()).toBe(false);
});
