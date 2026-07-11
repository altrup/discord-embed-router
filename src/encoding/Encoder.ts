import { Path, Token } from "path-to-regexp";

import { Method, RouteOptionsWithMethod } from "@routing/types";

/**
 * Symbol table between raw path segments and their encoded form. Subclass
 * to customize how paths are turned into (and back out of) compact strings
 * suitable for a Discord component customId.
 */
export abstract class Encoder {
	/**
	 * Saves an encoding for all the tokens in a path
	 *
	 * @param path the path to save encodings for
	 */
	public abstract registerPath<P extends Path>(path: P): void;

	/**
	 * Saves an encoding for a token
	 *
	 * @param token the token to save an encoding for
	 */
	public abstract registerToken(token: Token): void;

	/**
	 * Encodes a path
	 *
	 * @param path raw unencoded path
	 * @param method the html method to encode into the path
	 * @param query any query params to include in the encoded string
	 * @param idPrefix string to prefix the encoded path with
	 * @returns the encoded string
	 */
	public abstract encodePath<
		AllowEmptyMethod extends boolean = false,
		P extends Path = Path,
	>(
		path: P,
		options: RouteOptionsWithMethod<AllowEmptyMethod> & { idPrefix: string },
	): string;

	/**
	 * Decodes a path
	 *
	 * @param path the encoded path
	 * @param idPrefix string that the encoded path was prefixed with
	 * @param allowEmptyMethod if set to true, path will decode with possiblity of method being ""
	 * @returns the decoded path
	 */
	public abstract decodePath<P extends Path>(
		path: P,
		options: { idPrefix: string; allowEmptyMethod?: false },
	): { method: Method; path: string } | false;
	public abstract decodePath<P extends Path>(
		path: P,
		options: { idPrefix: string; allowEmptyMethod: true },
	): { method: Method | ""; path: string } | false;
}
