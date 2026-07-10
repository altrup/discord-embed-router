import type { InteractionEditReplyOptions } from "discord.js";

import type { State } from "@routing/types";

// A session's storage location (per-message vs. in-flight-interaction) is an
// implementation detail; handlers only ever see this uniform interface.
export type SessionHandle<Session> = {
	get(): Session | undefined;
	has(): boolean;
	set(session: Session): void;
	delete(): boolean;
};

// The exact state about to be handed to the interaction taking over this
// message's route handler. Its presence is the cleanup reason: a new state
// means a new interaction preempted this one, no new state means a real
// timeout (nobody came back). cleanupFn is always a closure created inside
// a route handler, so it already has its own session/globals/locals via
// that handler's own `state` — newState only needs to carry what wasn't
// already known when the closure was created.
export type CleanupHandler<Globals, Session, Locals> = (
	newState: State<Globals, Session, Locals> | undefined,
) =>
	| Promise<InteractionEditReplyOptions | undefined>
	| InteractionEditReplyOptions
	| undefined;

export type ApplyHandler = (
	options: string | InteractionEditReplyOptions,
) => Promise<unknown>;
