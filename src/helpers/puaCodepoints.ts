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

/**
 * Serializes a non-negative integer as base-PUA_RANGE digits, one PUA
 * codepoint per digit, most significant first, with no leading zeros. Not
 * part of the Encoder contract: reserved query params (whose values this
 * encodes) deliberately ride outside the pluggable path encoding.
 *
 * @param value the integer to serialize
 * @returns the PUA-character encoding of value
 */
export function encodePuaNumber(value: number): string {
	let chars = "";
	let remaining = Math.floor(value);
	do {
		chars = String.fromCodePoint(PUA_START + (remaining % PUA_RANGE)) + chars;
		remaining = Math.floor(remaining / PUA_RANGE);
	} while (remaining > 0);
	return chars;
}

/**
 * Parses a string of base-PUA_RANGE digits back into the integer
 * encodePuaNumber produced.
 *
 * @param encoded the PUA-character encoding to parse
 * @returns the parsed integer, or undefined if encoded is empty or contains
 * a non-PUA character
 */
export function decodePuaNumber(encoded: string): number | undefined {
	if (encoded.length === 0) return undefined;
	let value = 0;
	for (const char of encoded) {
		const digit = char.codePointAt(0)! - PUA_START;
		if (digit < 0 || digit >= PUA_RANGE) return undefined;
		value = value * PUA_RANGE + digit;
	}
	return value;
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
