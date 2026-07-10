import { ConfigError } from "@src/ConfigError";

/**
 * Throws if `data` carries any of the given keys. The Route* builders own
 * these fields (customId/value carry the encoded route; url and options
 * conflict with it), and the Omit<> in each constructor's type only guards
 * TypeScript callers, so JS callers are rejected here at runtime.
 *
 * @param data the constructor data to check
 * @param keys the keys the builder owns, in every accepted casing
 * @param builderName the builder's name, for the error message
 */
export const rejectKeys = (
	data: object,
	keys: readonly string[],
	builderName: string,
): void => {
	for (const key of keys) {
		if (key in data)
			throw new ConfigError(`${key} is not supported on ${builderName}`);
	}
};
