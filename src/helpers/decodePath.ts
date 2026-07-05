import { compile, Path } from "path-to-regexp";
import { AnySelectMenuInteraction, ButtonInteraction } from "discord.js";
import { BASE_URL } from "../consts";

export const decodePath = (
	idPrefix: string,
	interaction: ButtonInteraction | AnySelectMenuInteraction,
): Path | false => {
	const customId = interaction.customId;
	if (!customId.startsWith(idPrefix)) return false;

	if (interaction.isButton()) {
		return customId.slice(idPrefix.length);
	} else if (interaction.isStringSelectMenu()) {
		if (interaction.values.length === 0) return false;
		return fillParams(customId.slice(idPrefix.length), {
			to: interaction.values[0]!.split("/").slice(1),
		});
	} else if (interaction.isChannelSelectMenu()) {
		if (interaction.values.length === 0) return false;
		return fillParams(customId.slice(idPrefix.length), {
			channelId: interaction.values[0],
		});
	} else if (interaction.isRoleSelectMenu()) {
		if (interaction.values.length === 0) return false;
		return fillParams(customId.slice(idPrefix.length), {
			roleId: interaction.values[0],
		});
	} else if (interaction.isUserSelectMenu()) {
		if (interaction.values.length === 0) return false;
		return fillParams(customId.slice(idPrefix.length), {
			userId: interaction.values[0],
		});
	}

	return false;
};

const fillParams = (
	path: string,
	params: Partial<Record<string, string | string[]>> = {},
): string => {
	const url = new URL(path, BASE_URL);
	const toPath = compile(url.pathname);

	url.pathname = toPath(params);
	for (const [key, value] of url.searchParams) {
		if (value.startsWith(":") && key.slice(1) in params) {
			const paramValue = params?.[key.slice(1)];
			if (paramValue) {
				url.searchParams.set(
					key,
					Array.isArray(paramValue) ? paramValue.join("/") : paramValue,
				);
			} else {
				url.searchParams.delete(key);
			}
		}
	}
	return `${url.pathname}${url.search}`;
};
