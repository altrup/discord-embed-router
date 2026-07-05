import { Interaction, InteractionEditReplyOptions } from "discord.js";
import { MatchFunction, MatchResult, ParamData, Path } from "path-to-regexp";

export type State<P extends ParamData> = MatchResult<P> & {
	searchParams: URLSearchParams;
};
export type RouteResponse = InteractionEditReplyOptions;
export type RouteHandler<P extends ParamData> = (
	interaction: Interaction,
	state: State<P>,
) => RouteResponse;

export type CompiledRoute<P extends ParamData> = {
	path: Path[];
	matchFunction: MatchFunction<P>;
	handler: RouteHandler<P>;
};
export type ResolvedRoute<P extends ParamData> = {
	state: State<P>;
	handler: RouteHandler<P>;
};
