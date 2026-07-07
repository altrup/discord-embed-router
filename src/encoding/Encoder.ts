import { createHash } from "node:crypto";
import { parse, Path, stringify, Token } from "path-to-regexp";

import { PUA_RANGE, PUA_START, PUA_SPLIT_PATTERN } from "@src/consts";
import { ENCODING_TO_METHOD, METHOD_TO_ENCODING } from "@encoding/consts";

import { pathToString } from "@helpers/pathToString";
import { isMethodEncoding } from "@encoding/types";
import { Method, RouteOptionsWithMethod } from "@routing/types";
import { Location } from "@helpers/Location";

export class Encoder {
	#segmentToEncoding: Map<string, string> = new Map();
	#encodingToSegment: Map<string, string> = new Map();

	constructor() {}

	/**
	 * Saves an encoding for all the tokens in a path using registerToken
	 *
	 * @param path the path to save encodings for
	 */
	public registerPath<P extends Path>(path: P) {
		// don't check validity; path may include query params
		const location = new Location(pathToString(path, false));
		location.tokens.forEach((t) => this.registerToken(t));
	}

	/**
	 * Saves an encoding for a token
	 *
	 * @param token the token to save an encoding for
	 */
	public registerToken(token: Token) {
		if (token.type === "group") {
			// register all sub tokens
			for (const t of token.tokens) {
				this.registerToken(t);
			}
			return;
		}

		const segments = this.#tokensToSegments([token]);
		segments.forEach((s) => this.#registerSegment(s));
	}

	// returns encoding
	#registerSegment(segment: string): string {
		const existingEncoding = this.#segmentToEncoding.get(segment);
		if (existingEncoding) return existingEncoding; // already registered

		const hash = createHash("sha256").update(segment).digest();
		let raw = hash.readUint32BE(0);
		let char: string;
		const pathCollisions = [];
		// find next available identifier
		while (true) {
			const codepoint = PUA_START + (raw++ % PUA_RANGE);
			char = String.fromCodePoint(codepoint);

			const pathCollision = this.#encodingToSegment.get(char);
			if (pathCollision === undefined) break; // no collisions

			pathCollisions.push(pathCollision);
		}

		if (pathCollisions.length > 0) {
			process.emitWarning(
				`Encoder path segment identifier collision for "${segment}" with ${pathCollisions.join(", ")}`,
				"DiscordEmbedRouterWarning",
			);
		}

		this.#segmentToEncoding.set(segment, char);
		this.#encodingToSegment.set(char, segment);

		return char;
	}

	/**
	 * Encodes a path
	 *
	 * @param path raw unencoded path
	 * @param method the html method to encode into the path
	 * @param query any query params to include in the encoded string
	 * @param idPrefix string to prefix the encoded path with
	 * @returns the encoded string
	 */
	public encodePath = <
		AllowEmptyMethod extends boolean = false,
		P extends Path = Path,
	>(
		path: P,
		{
			idPrefix,
			method,
			query,
		}: RouteOptionsWithMethod<AllowEmptyMethod> & {
			idPrefix: string;
		},
	) => {
		// don't check validity; path may include query params
		const location = new Location(pathToString(path, false), query);
		location.tokens = this.#encodeTokens(location.tokens);

		return `${idPrefix}${method === "" ? "" : METHOD_TO_ENCODING[method as Method]}${location.toString()}`;
	};

	#encodeTokens(tokens: Token[]): Token[] {
		const encodedTokens: Token[] = [];
		for (const token of tokens) {
			if (token.type === "group") {
				encodedTokens.push({
					type: "group",
					tokens: this.#encodeTokens(token.tokens),
				});
			} else {
				const segments = this.#tokensToSegments([token]);
				encodedTokens.push(
					...segments
						.map((s): Token | Token[] => {
							const encodedValue = this.#segmentToEncoding.get(s);
							if (encodedValue === undefined) {
								for (const char of s) {
									const codepoint = char.codePointAt(0)!;
									if (
										codepoint >= PUA_START &&
										codepoint < PUA_START + PUA_RANGE
									) {
										throw new Error(
											`Path segment "${s}" contains a reserved Private Use Area character (U+${codepoint.toString(16)}). Segments containing PUA characters must be preregistered using registerPath or registerToken.`,
										);
									}
								}
							}
							return encodedValue === undefined
								? parse(s).tokens
								: {
										type: "text",
										value: encodedValue,
									};
						})
						.flat(),
				);
			}
		}
		return encodedTokens;
	}

	/**
	 * Decodes a path
	 *
	 * @param path the encoded path
	 * @param idPrefix string that the encoded path was prefixed with
	 * @param allowEmptyMethod if set to true, path will decode with possiblity of method being ""
	 * @returns the decoded path
	 */
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
		{
			idPrefix,
			allowEmptyMethod = false,
		}: { idPrefix: string; allowEmptyMethod?: boolean },
	): { method: Method | ""; path: string } | false {
		// don't check validity; path may include query params
		const pathString = pathToString(path, false);
		if (!pathString.startsWith(idPrefix)) return false;

		const res = allowEmptyMethod
			? this.#parseMethodAndPath(pathString.slice(idPrefix.length), true)
			: this.#parseMethodAndPath(pathString.slice(idPrefix.length), false);
		if (!res) return false;
		const { method, path: encodedPath } = res;
		const location = new Location(encodedPath);
		location.tokens = this.#decodeTokens(location.tokens);

		return {
			method,
			path: location.toString(),
		};
	}

	#parseMethodAndPath(
		pathWithMethod: string,
		allowEmptyMethod?: false,
	): { method: Method; path: string } | false;
	#parseMethodAndPath(
		pathWithMethod: string,
		allowEmptyMethod: true,
	): { method: Method | ""; path: string };
	#parseMethodAndPath(
		pathWithMethod: string,
		allowEmptyMethod = false,
	): { method: Method | ""; path: string } | false {
		const firstChar = pathWithMethod.charAt(0);
		if (!isMethodEncoding(firstChar)) {
			if (allowEmptyMethod) return { method: "", path: pathWithMethod };
			return false;
		}

		return {
			method: ENCODING_TO_METHOD[firstChar],
			path: pathWithMethod.slice(1),
		};
	}

	#decodeTokens(tokens: Token[]): Token[] {
		const decodedTokens: Token[] = [];
		for (const token of tokens) {
			if (token.type === "group") {
				decodedTokens.push({
					type: "group",
					tokens: this.#decodeTokens(token.tokens),
				});
			} else {
				const segments = this.#tokensToSegments([token])
					.map((s) => s.split(PUA_SPLIT_PATTERN))
					.flat();
				decodedTokens.push(
					...segments
						.map((s) => parse(this.#encodingToSegment.get(s) ?? s).tokens)
						.flat(),
				);
			}
		}
		return decodedTokens;
	}

	#tokensToSegments(tokens: Token[]): string[] {
		return stringify({ tokens })
			.split(/(?=\/)/)
			.filter((v) => v.length > 0);
	}
}
