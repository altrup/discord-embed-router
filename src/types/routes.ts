import { Interaction, InteractionEditReplyOptions } from "discord.js";
import { MatchFunction, MatchResult, ParamData, Path } from "path-to-regexp";
import type { EmbedRouter } from "../EmbedRouter";

export type State<L, P extends ParamData = ParamData> = MatchResult<P> & {
	embedRouter: EmbedRouter<L>;
	locals?: L | undefined;
	query: URLSearchParams;
};
export type RouteResponse = InteractionEditReplyOptions;
export type RouteHandler<L, P extends ParamData = ParamData> = (
	interaction: Interaction,
	state: State<L, P>,
) => RouteResponse;

export type CompiledRoute<L, P extends ParamData = ParamData> = {
	path: Path[];
	matchFunction: MatchFunction<P>;
	handler: RouteHandler<L, P>;
};
export type ResolvedRoute<L, P extends ParamData = ParamData> = {
	state: State<L, P>;
	handler: RouteHandler<L, P>;
};
