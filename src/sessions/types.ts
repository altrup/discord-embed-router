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

// newState's presence is the reason: defined means a new interaction
// preempted this one, undefined means a real timeout. cleanupFn closes over
// its own session/globals/locals from when it was created, so newState only
// needs to carry what wasn't already known then.
export type CleanupHandler<Globals, Session, Locals> = (
	newState: State<Globals, Session, Locals> | undefined,
) =>
	| Promise<InteractionEditReplyOptions | undefined>
	| InteractionEditReplyOptions
	| undefined;

export type ApplyHandler = (
	options: string | InteractionEditReplyOptions,
) => Promise<unknown>;
