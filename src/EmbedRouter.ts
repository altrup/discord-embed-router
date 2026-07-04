import path from "node:path";
import {
	match,
	ParamData,
	parse,
	Path,
	stringify,
	TokenData,
} from "path-to-regexp";
import { CompiledRoute, RouteHandler } from "./types/routes";
import { ExtractParams } from "./types/ExtractParams";

export default class EmbedRouter {
	// single path -> RouteHandler
	private routes: CompiledRoute<ParamData>[] = [];

	constructor() {}

	// main command for registering paths
	on<P extends Path = Path>(
		routePath: P | P[],
		handler: RouteHandler<ExtractParams<P>>,
	) {
		this.routes.push({
			path: Array.isArray(routePath) ? routePath : [routePath],
			matchFunction: match(routePath),
			handler: handler as RouteHandler<ParamData>,
		});
	}

	// command for adding a subrouter
	use<P extends Path = Path>(routePath: P, router: EmbedRouter) {
		const pathString = stringify(
			routePath instanceof TokenData ? routePath : parse(routePath),
		);
		for (const route of router.routes) {
			this.on(
				route.path.map((p) =>
					path.posix.join(
						pathString,
						stringify(p instanceof TokenData ? p : parse(p)),
					),
				),
				route.handler,
			);
		}
	}
}
