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
