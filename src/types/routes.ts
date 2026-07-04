import {
	Interaction,
	InteractionReplyOptions,
	MessagePayload,
} from "discord.js";
import { MatchFunction, MatchResult, ParamData, Path } from "path-to-regexp";

export type State<P extends ParamData> = MatchResult<P> & {
	urlParams: Record<string, string>;
};
export type RouteResponse = string | MessagePayload | InteractionReplyOptions;
export type RouteHandler<P extends ParamData> = (
	interaction: Interaction,
	state: State<P>,
) => RouteResponse;
export type CompiledRoute<P extends ParamData> = {
	path: Path[];
	matchFunction: MatchFunction<P>;
	handler: RouteHandler<ParamData>;
};
