import { expect, test } from "vitest";

import { MessageQueue } from "@routing/MessageQueue";

/**
 * A promise plus its externally-callable resolve, for controlling ordering deterministically
 *
 * @returns the promise and a function to resolve it
 */
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => (resolve = r));
	return { promise, resolve };
}

test("tasks for the same message run sequentially", async () => {
	const queue = new MessageQueue();
	const order: string[] = [];
	const first = deferred<void>();

	const a = queue.run("msg1", async () => {
		order.push("a-start");
		await first.promise;
		order.push("a-end");
	});
	const b = queue.run("msg1", async () => {
		order.push("b-start");
	});

	// b must not have started yet; a is still awaiting `first`
	await Promise.resolve();
	await Promise.resolve();
	expect(order).toStrictEqual(["a-start"]);

	first.resolve();
	await Promise.all([a, b]);
	expect(order).toStrictEqual(["a-start", "a-end", "b-start"]);
});

test("tasks for different messages don't block each other", async () => {
	const queue = new MessageQueue();
	const order: string[] = [];
	const blockA = deferred<void>();

	const a = queue.run("msg1", async () => {
		await blockA.promise;
		order.push("a");
	});
	const b = queue.run("msg2", async () => {
		order.push("b");
	});

	await b;
	expect(order).toStrictEqual(["b"]);

	blockA.resolve();
	await a;
	expect(order).toStrictEqual(["b", "a"]);
});

test("isBusy() is true while queued work is pending and false once it's all settled", async () => {
	const queue = new MessageQueue();
	expect(queue.isBusy("msg1")).toBe(false);

	const block = deferred<void>();
	const task = queue.run("msg1", async () => {
		await block.promise;
	});

	expect(queue.isBusy("msg1")).toBe(true);
	block.resolve();
	await task;
	expect(queue.isBusy("msg1")).toBe(false);
});

test("isBusy() stays true across chained tasks until the last one finishes", async () => {
	const queue = new MessageQueue();
	const blockA = deferred<void>();
	const blockB = deferred<void>();

	const a = queue.run("msg1", async () => {
		await blockA.promise;
	});
	const b = queue.run("msg1", async () => {
		await blockB.promise;
	});

	blockA.resolve();
	await a;
	// b is still pending, so the message should still be considered busy
	expect(queue.isBusy("msg1")).toBe(true);

	blockB.resolve();
	await b;
	expect(queue.isBusy("msg1")).toBe(false);
});

test("a rejected task doesn't wedge the queue for later tasks", async () => {
	const queue = new MessageQueue();

	const a = queue.run("msg1", async () => {
		throw new Error("boom");
	});
	const b = queue.run("msg1", async () => "ok");

	await expect(a).rejects.toThrow("boom");
	await expect(b).resolves.toBe("ok");
});

test("each run() resolves with its own task's result, not a neighbor's", async () => {
	const queue = new MessageQueue();

	const a = queue.run("msg1", async () => "a-result");
	const b = queue.run("msg1", async () => "b-result");

	await expect(a).resolves.toBe("a-result");
	await expect(b).resolves.toBe("b-result");
});
