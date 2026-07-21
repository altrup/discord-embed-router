import { MessageFlags } from "discord.js";

// carries the RouteInfo of the matched route on errors thrown by its
// handler, so routeError can report which route failed
export const ROUTE_INFO = Symbol("routeInfo");

// the flag bits settable when creating a reply; flags carried in a customId
// are masked to these on both encode and decode, so a forged or garbled
// value can't smuggle other bits into interaction.reply()
export const REPLY_FLAGS: number =
	MessageFlags.Ephemeral |
	MessageFlags.SuppressEmbeds |
	MessageFlags.SuppressNotifications |
	MessageFlags.IsComponentsV2;
