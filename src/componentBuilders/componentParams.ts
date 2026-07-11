import { ROUTE_BUTTON_BUILDER_PARAMS } from "@componentBuilders/RouteButtonBuilder";
import { ROUTE_CHANNEL_SELECT_MENU_BUILDER_PARAMS } from "@componentBuilders/RouteChannelSelectMenuBuilder";
import { ROUTE_MODAL_BUILDER_PARAMS } from "@componentBuilders/RouteModalBuilder";
import { ROUTE_ROLE_SELECT_MENU_BUILDER_PARAMS } from "@componentBuilders/RouteRoleSelectMenuBuilder";
import { ROUTE_STRING_SELECT_MENU_BUILDER_PARAMS } from "@componentBuilders/RouteStringSelectMenuBuilder";
import { ROUTE_STRING_SELECT_MENU_OPTION_BUILDER_PARAMS } from "@componentBuilders/RouteStringSelectMenuOptionBuilder";
import { ROUTE_USER_SELECT_MENU_BUILDER_PARAMS } from "@componentBuilders/RouteUserSelectMenuBuilder";

// deduplicated union of every componentBuilder's own path params, so
// EmbedRouter can register them all without knowing about individual builders
export const COMPONENT_PARAMS = [
	...new Set([
		...ROUTE_BUTTON_BUILDER_PARAMS,
		...ROUTE_MODAL_BUILDER_PARAMS,
		...ROUTE_USER_SELECT_MENU_BUILDER_PARAMS,
		...ROUTE_ROLE_SELECT_MENU_BUILDER_PARAMS,
		...ROUTE_CHANNEL_SELECT_MENU_BUILDER_PARAMS,
		...ROUTE_STRING_SELECT_MENU_BUILDER_PARAMS,
		...ROUTE_STRING_SELECT_MENU_OPTION_BUILDER_PARAMS,
	]),
];
