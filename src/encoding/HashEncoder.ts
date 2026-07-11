import { parse, Path, stringify, Token } from "path-to-regexp";

import { ENCODING_TO_METHOD, METHOD_TO_ENCODING } from "@encoding/consts";
import { Encoder } from "@encoding/Encoder";
import { isMethodEncoding } from "@encoding/types";
import { Location } from "@helpers/Location";
import { pathToString } from "@helpers/pathToString";
import { puaCodepointsFrom } from "@helpers/puaCodepoints";
import { Method, RouteOptionsWithMethod } from "@routing/types";
import { ConfigError } from "@src/ConfigError";
import { PUA_RANGE, PUA_RUN_BOUNDARY_PATTERN, PUA_START } from "@src/consts";

/**
 * Default `Encoder`: hashes each registered path segment down to a fixed-
 * length run of Private Use Area characters, with collisions resolved by
 * scanning forward from the hash.
 */
export class HashEncoder extends Encoder {
	#segmentToEncoding: Map<string, string> = new Map();
	#encodingToSegment: Map<string, string> = new Map();
	// number of PUA characters used per encoded segment
	#segmentLength: number;

	/**
	 * @param segmentLength number of PUA characters used per encoded segment;
	 * higher values increase encoding capacity (PUA_RANGE ** segmentLength
	 * unique codes) at the cost of a longer encoded string per segment.
	 */
	constructor({ segmentLength = 1 }: { segmentLength?: number } = {}) {
		super();
		this.#segmentLength = segmentLength;
	}

	public registerPath<P extends Path>(path: P) {
		// don't check validity; path may include query params
		const location = new Location(pathToString(path, false));
		location.tokens.forEach((t) => this.registerToken(t));
	}

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

		const space = PUA_RANGE ** this.#segmentLength;
		if (this.#encodingToSegment.size >= space)
			throw new ConfigError(
				`Cannot register segment "${segment}": every ${this.#segmentLength}-character encoding (${space} total) is already in use. Increase segmentLength to register more segments.`,
			);

		let code: string | undefined;
		const pathCollisions = [];
		// find next available identifier; the size check above guarantees the
		// generator (which cycles through the whole space before repeating)
		// finds one within `space` candidates
		for (const candidate of puaCodepointsFrom(segment, this.#segmentLength)) {
			const pathCollision = this.#encodingToSegment.get(candidate);
			if (pathCollision === undefined) {
				code = candidate;
				break;
			}
			pathCollisions.push(pathCollision);
		}
		if (code === undefined)
			throw new ConfigError(
				`Internal error: no available encoding found for segment "${segment}" despite passing the capacity check`,
			);

		if (pathCollisions.length > 0) {
			process.emitWarning(
				`Encoder path segment identifier collision for "${segment}" with ${pathCollisions.join(", ")}`,
				"DiscordEmbedRouterWarning",
			);
		}

		this.#segmentToEncoding.set(segment, code);
		this.#encodingToSegment.set(code, segment);

		return code;
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
		}: RouteOptionsWithMethod<true, AllowEmptyMethod> & {
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
										throw new ConfigError(
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
					.map((s) => this.#splitEncodedSegment(s))
					.flat();
				decodedTokens.push(
					...segments
						.map((s) => parse(this.#decodeSegment(s)).tokens)
						.flat(),
				);
			}
		}
		return decodedTokens;
	}

	// an unregistered PUA chunk means a forged or stale customId
	#decodeSegment(segment: string): string {
		const decoded = this.#encodingToSegment.get(segment);
		if (decoded !== undefined) return decoded;
		if (isPua(segment.codePointAt(0)!))
			throw new Error(`Unregistered encoded segment "${segment}"`);
		return segment;
	}

	// splits a piece of an encoded path into its original segments: text runs
	// pass through untouched, while PUA runs (each a concatenation of one or
	// more `segmentLength`-sized encoded segments) are chunked back apart
	#splitEncodedSegment(segment: string): string[] {
		return segment
			.split(PUA_RUN_BOUNDARY_PATTERN)
			.filter((run) => run.length > 0)
			.flatMap((run) =>
				isPua(run.codePointAt(0)!) ? chunk(run, this.#segmentLength) : [run],
			);
	}

	#tokensToSegments(tokens: Token[]): string[] {
		return stringify({ tokens })
			.split(/(?=\/)/)
			.filter((v) => v.length > 0);
	}
}

function isPua(codepoint: number): boolean {
	return codepoint >= PUA_START && codepoint < PUA_START + PUA_RANGE;
}

function chunk(str: string, size: number): string[] {
	const chunks: string[] = [];
	for (let i = 0; i < str.length; i += size) {
		chunks.push(str.slice(i, i + size));
	}
	return chunks;
}
