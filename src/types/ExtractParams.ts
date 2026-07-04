import { ParamData, TokenData } from "path-to-regexp";

type TakeIdentifier<
	T extends string,
	Name extends string = "",
> = T extends `${infer Char}${infer Rest}`
	? Char extends "/" | ":" | "*" | "{" | "}"
		? [Name, T]
		: TakeIdentifier<Rest, `${Name}${Char}`>
	: [Name, T];

type TakeQuoted<
	T extends string,
	Name extends string = "",
> = T extends `"${infer Rest}`
	? [Name, Rest]
	: T extends `${infer Char}${infer Rest}`
		? TakeQuoted<Rest, `${Name}${Char}`>
		: [Name, T];

type ParseName<T extends string> = T extends `"${infer Rest}`
	? TakeQuoted<Rest>
	: TakeIdentifier<T>;

export type ExtractParams<
	T extends string | TokenData,
	Depth extends string = "",
> = T extends TokenData
	? ParamData
	: T extends string
		? T extends `${infer Char}${infer Rest}`
			? Char extends ":" | "*"
				? ParseName<Rest> extends [
						infer Name extends string,
						infer After extends string,
					]
					? (Depth extends ""
							? { [K in Name]: string }
							: { [K in Name]?: string }) &
							ExtractParams<After, Depth>
					: ExtractParams<Rest, Depth>
				: Char extends "{"
					? ExtractParams<Rest, `${Depth}1`>
					: Char extends "}"
						? ExtractParams<
								Rest,
								Depth extends `1${infer Rest2}` ? Rest2 : Depth
							>
						: ExtractParams<Rest, Depth>
			: object
		: never;
