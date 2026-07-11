import {
	Interaction,
	InteractionEditReplyOptions,
	ModalComponentData,
	ModalSubmitFields,
} from "discord.js";
import {
	MatchFunction,
	MatchResult,
	ParamData,
	Path,
	TokenData,
} from "path-to-regexp";

import type { RouteModalBuilder } from "@componentBuilders/RouteModalBuilder";
import type { EmbedRouter } from "@routing/EmbedRouter";
import type { CleanupHandler, SessionHandle } from "@sessions/types";

// EmbedRouter

export type State<
	Globals,
	Session,
	Locals,
	P extends ParamData = ParamData,
> = MatchResult<P> & {
	globals?: Globals | undefined;
	session: SessionHandle<Session>;
	locals?: Locals | undefined;
	queryParams: URLSearchParams;
	// submitted modal inputs; only set when the dispatch came from a ModalSubmitInteraction
	fields?: ModalSubmitFields | undefined;
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const UNUSED: unique symbol;
export type Unused = typeof UNUSED;
export type RouteRender<Globals, Session, Locals> =
	InteractionEditReplyOptions &
		(
			| ({ cleanup?: undefined } & (Unused extends Session
					? { timeout?: undefined }
					: { timeout?: number }))
			| {
					cleanup: CleanupHandler<Globals, Session, Locals>;
					timeout: number;
			  }
		);
// hands off rendering to another registered path, always resolved as a GET.
// no cleanup/timeout here: only a renderer should own those, so a redirect
// that wants one set passes it via the target's path/query instead
export type RouteRedirect = { redirect: Path };
export type RouteResult<Globals, Session, Locals> =
	RouteRedirect | RouteRender<Globals, Session, Locals>;
// the modal to show; showModal() itself accepts either a builder or plain data
export type ModalRender<Globals, Session, Locals> =
	RouteModalBuilder<Globals, Session, Locals> | ModalComponentData;
// no cleanup/timeout here: showing a modal never edits the message, so
// there's nothing for a cleanup to preempt or a timeout to guard
export type ModalResult<Globals, Session, Locals> =
	ModalRender<Globals, Session, Locals> | RouteRedirect | undefined;
// MODAL handlers get a read-only session (e.g. to prefill inputs from a
// draft a render committed earlier): nothing commits on the showModal path,
// so writes belong to the render that offers the modal or to the route that
// processes its submission. set/delete throw a ConfigError at runtime
export type ModalState<
	Globals,
	Session,
	Locals,
	P extends ParamData = ParamData,
> = Omit<State<Globals, Session, Locals, P>, "session"> & {
	session: Pick<SessionHandle<Session>, "get" | "has">;
};
export type RouteHandler<
	M extends Method,
	Globals,
	Session,
	Locals,
	P extends ParamData = ParamData,
> = (
	embedRouter: EmbedRouter<Globals, Session, Locals>,
	interaction: Interaction,
	state: M extends "MODAL"
		? ModalState<Globals, Session, Locals, P>
		: State<Globals, Session, Locals, P>,
) => M extends "GET"
	? | Promise<RouteResult<Globals, Session, Locals>>
		| RouteResult<Globals, Session, Locals>
	: M extends "MODAL"
		? | Promise<ModalResult<Globals, Session, Locals>>
			| ModalResult<Globals, Session, Locals>
		: // non-GET routes only mutate: redirect to a renderer, or ack silently
			Promise<RouteRedirect | undefined> | RouteRedirect | undefined;
export type SessionProvider<Globals, Session, Locals> = (
	embedRouter: EmbedRouter<Globals, Session, Locals>,
	interaction: Interaction,
) => Session;
export type LocalsProvider<Globals, Session, Locals> = (
	embedRouter: EmbedRouter<Globals, Session, Locals>,
	interaction: Interaction,
) => Locals;

export const methodsList = [
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
	"MODAL",
] as const;
export type Method = (typeof methodsList)[number];
export type CompiledRoute<
	M extends Method,
	Globals,
	Session,
	Locals,
	P extends ParamData = ParamData,
> = {
	method: Method;
	path: Path[];
	matchFunction: MatchFunction<P>;
	handler: RouteHandler<M, Globals, Session, Locals, P>;
};

export type RouteOptions<AllowModal extends boolean = false> = {
	method?: AllowModal extends true ? Method : Exclude<Method, "MODAL">;
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
