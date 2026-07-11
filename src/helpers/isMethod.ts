import { methodsList, type Method } from "@routing/types";

/**
 * Runtime counterpart to RouteOptions<AllowModalMethod>/RouteOptionsWithMethod
 * <AllowModalMethod, AllowEmptyMethod>'s Method restrictions, for a JS caller
 * (or an `as any`) bypassing the type.
 *
 * @param value the value to check
 * @param options.allowModal whether "MODAL" counts as valid; defaults to
 * false since dispatch is the only place a MODAL method makes sense to accept
 * @param options.allowEmpty whether "" counts as valid, e.g. a select menu
 * option deliberately overriding the menu's own method
 * @returns whether value is a valid Method
 */
export const isMethod = <
	AllowModalMethod extends boolean = false,
	AllowEmptyMethod extends boolean = false,
>(
	value: unknown,
	{
		allowModal = false as AllowModalMethod,
		allowEmpty = false as AllowEmptyMethod,
	}: { allowModal?: AllowModalMethod; allowEmpty?: AllowEmptyMethod } = {},
): value is
	| (AllowModalMethod extends true ? Method : Exclude<Method, "MODAL">)
	| (AllowEmptyMethod extends true ? "" : never) =>
	(allowEmpty && value === "") ||
	(typeof value === "string" &&
		(methodsList as readonly string[]).includes(value) &&
		(allowModal || value !== "MODAL"));
