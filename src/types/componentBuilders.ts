import { Method } from "./routes";

export type RouteOptions = {
	method?: Method;
	query?: ConstructorParameters<typeof URLSearchParams>[0] | undefined;
};
