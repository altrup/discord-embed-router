import { Interaction, InteractionEditReplyOptions } from "discord.js";
import { MatchFunction, MatchResult, ParamData, Path } from "path-to-regexp";
import type { EmbedRouter } from "../EmbedRouter";

export type State<L, P extends ParamData = ParamData> = MatchResult<P> & {
	embedRouter: EmbedRouter<L>;
	locals?: L | undefined;
	query: URLSearchParams;
};
export type RouteResponse = InteractionEditReplyOptions | undefined;
export type RouteHandler<
	M extends Method,
	L,
	P extends ParamData = ParamData,
> = (
	interaction: Interaction,
	state: State<L, P>,
) => M extends "GET"
	? Promise<RouteResponse> | RouteResponse
	: Promise<RouteResponse | undefined> | RouteResponse | undefined;

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type CompiledRoute<
	M extends Method,
	L,
	P extends ParamData = ParamData,
> = {
	method: Method;
	path: Path[];
	matchFunction: MatchFunction<P>;
	handler: RouteHandler<M, L, P>;
};
