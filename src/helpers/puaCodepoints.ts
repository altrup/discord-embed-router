import { createHash } from "node:crypto";

import { PUA_RANGE, PUA_START } from "@src/consts";

/**
 * Yields PUA-character candidates deterministically derived from `seed`,
 * starting from a hash-derived offset and cycling through the full space of
 * `length`-character codes. Callers scan this until they find a candidate
 * not already in use, applying their own collision policy.
 *
 * `length` controls how many PUA characters make up each candidate: each
 * candidate is `length` base-PUA_RANGE digits, one PUA codepoint per digit.
 */
export function* puaCodepointsFrom(
	seed: string,
	length = 1,
): Generator<string> {
	const space = BigInt(PUA_RANGE) ** BigInt(length);
	const hash = createHash("sha256").update(seed).digest();
	let raw = hash.readBigUInt64BE(0) % space;
	while (true) {
		yield puaDigits(raw, length);
		raw = (raw + 1n) % space;
	}
}

function puaDigits(value: bigint, length: number): string {
	let chars = "";
	let remaining = value;
	for (let i = 0; i < length; i++) {
		const digit = Number(remaining % BigInt(PUA_RANGE));
		remaining /= BigInt(PUA_RANGE);
		chars = String.fromCodePoint(PUA_START + digit) + chars;
	}
	return chars;
}
