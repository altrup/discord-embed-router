import { Method } from "./routes";

export type RouteOptions<AllowEmptyMethod extends boolean = false> = {
	method?: AllowEmptyMethod extends false ? Method : Method | "";
	query?: ConstructorParameters<typeof URLSearchParams>[0] | undefined;
};
