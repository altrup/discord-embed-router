import type { Interaction, RepliableInteraction } from "discord.js";

/**
 * Returns whether an interaction is a type this router can dispatch: anything
 * it can reply to, which is every interaction except autocomplete (and ping,
 * which a gateway client never receives).
 *
 * @param interaction the interaction to check
 * @returns if interaction is a supported type
 */
export function isSupportedInteraction(
	interaction: Interaction,
): interaction is RepliableInteraction {
	return interaction.isRepliable();
}
