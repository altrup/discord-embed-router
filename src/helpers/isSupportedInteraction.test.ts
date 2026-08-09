import { BaseInteraction, Interaction, InteractionType } from "discord.js";
import { expect, test } from "vitest";

import { isSupportedInteraction } from "@helpers/isSupportedInteraction";

// exercises discord.js's own predicate rather than a hand-written stub, so the
// supported set stays tied to what the library actually considers repliable
const interactionOfType = (type: InteractionType): Interaction =>
	Object.create(BaseInteraction.prototype, {
		type: { value: type },
	}) as Interaction;

test.each([
	[InteractionType.ApplicationCommand, true],
	[InteractionType.MessageComponent, true],
	[InteractionType.ModalSubmit, true],
	[InteractionType.ApplicationCommandAutocomplete, false],
	[InteractionType.Ping, false],
])("interaction type %i is supported: %s", (type, supported) => {
	expect(isSupportedInteraction(interactionOfType(type))).toBe(supported);
});
