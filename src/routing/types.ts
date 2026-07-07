import { Interaction, InteractionEditReplyOptions } from "discord.js";
import {
	MatchFunction,
	MatchResult,
	ParamData,
	Path,
	TokenData,
} from "path-to-regexp";
import type { EmbedRouter } from "../routing/EmbedRouter";

// EmbedRouter

export type State<
	L extends object,
	P extends ParamData = ParamData,
> = MatchResult<P> & {
	embedRouter: EmbedRouter<L>;
	locals?: L | undefined;
	queryParams: URLSearchParams;
};
export type RouteResponse = InteractionEditReplyOptions &
	(
		| { cleanup?: undefined; timeout?: undefined }
		| {
				cleanup: CleanupHandler;
				timeout: number;
		  }
	);
export type RouteHandler<
	M extends Method,
	L extends object,
	P extends ParamData = ParamData,
> = (
	interaction: Interaction,
	state: State<L, P>,
) => M extends "GET"
	? Promise<RouteResponse> | RouteResponse
	: Promise<RouteResponse | undefined> | RouteResponse | undefined;
export type CleanupHandler = () =>
	| Promise<InteractionEditReplyOptions | undefined>
	| InteractionEditReplyOptions
	| undefined;
export type ApplyHandler = (
	options: string | InteractionEditReplyOptions,
) => Promise<unknown>;

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type CompiledRoute<
	M extends Method,
	L extends object,
	P extends ParamData = ParamData,
> = {
	method: Method;
	path: Path[];
	matchFunction: MatchFunction<P>;
	handler: RouteHandler<M, L, P>;
};

export type RouteOptions = {
	method?: Method;
	query?: ConstructorParameters<typeof URLSearchParams>[0] | undefined;
};
export type RouteOptionsWithMethod<AllowEmptyMethod extends boolean = false> = {
	method: AllowEmptyMethod extends false ? Method : Method | "";
	query?: ConstructorParameters<typeof URLSearchParams>[0] | undefined;
};

// Param Extraction

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

// EventEmitter

type EventMap<T> = Record<keyof T, unknown[]>;
type IfEventMap<
	Events extends EventMap<Events>,
	True,
	False,
> = object extends Events ? False : True;
interface EventEmitterEventMap {
	newListener: [
		eventName: string | symbol,
		listener: (...args: unknown[]) => void,
	];
	removeListener: [
		eventName: string | symbol,
		listener: (...args: unknown[]) => void,
	];
}

export type EventNames<
	Events extends EventMap<Events>,
	EventName extends string | symbol,
> = IfEventMap<
	Events,
	EventName | (keyof Events & (string | symbol)) | keyof EventEmitterEventMap,
	string | symbol
>;

export type Args<
	Events extends EventMap<Events>,
	EventName extends string | symbol,
> = IfEventMap<
	Events,
	EventName extends keyof Events
		? Events[EventName]
		: EventName extends keyof EventEmitterEventMap
			? EventEmitterEventMap[EventName]
			: unknown[],
	unknown[]
>;

export type Listener<
	Events extends EventMap<Events>,
	EventName extends string | symbol,
> = IfEventMap<
	Events,
	(
		...args: EventName extends keyof Events
			? Events[EventName]
			: EventName extends keyof EventEmitterEventMap
				? EventEmitterEventMap[EventName]
				: unknown[]
	) => void,
	(...args: unknown[]) => void
>;
