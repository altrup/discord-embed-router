import type { Interaction } from "discord.js";

/**
 * Returns whether an interaction is a type this router can dispatch:
 * component, chat input command, or modal submit.
 *
 * @param interaction the interaction to check
 * @returns if interaction is a supported type
 */
export function isSupportedInteraction(interaction: Interaction) {
	return (
		interaction.isMessageComponent() ||
		interaction.isChatInputCommand() ||
		interaction.isModalSubmit()
	);
}
