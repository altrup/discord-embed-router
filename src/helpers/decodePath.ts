import { compile, Path } from "path-to-regexp";
import { AnySelectMenuInteraction, ButtonInteraction } from "discord.js";
import { BASE_URL, ENCODING_TO_METHOD } from "../consts";
import { Method } from "../types/routes";

export const decodePath = ({
	idPrefix,
	interaction,
}: {
	idPrefix: string;
	interaction: ButtonInteraction | AnySelectMenuInteraction;
}): { method: Method; path: Path } | false => {
	const customId = interaction.customId;
	if (!customId.startsWith(idPrefix)) return false;

	if (interaction.isButton()) {
		return parseMethodAndPath(customId.slice(idPrefix.length));
	} else if (interaction.isAnySelectMenu()) {
		if (interaction.values.length === 0) return false;
		const res = parseMethodAndPath(customId.slice(idPrefix.length));
		if (!res) return false;

		const { method, path } = res;
		return {
			method,
			path: fillParams(path, {
				[interaction.isStringSelectMenu()
					? "to"
					: interaction.isChannelSelectMenu()
						? "channelId"
						: interaction.isRoleSelectMenu()
							? "roleId"
							: "userId"]: interaction.values[0]!.split("/").slice(1),
			}),
		};
	}

	return false;
};

export const parseMethodAndPath = (
	pathWithMethod: string,
): { method: Method; path: string } | false => {
	// path always start with "/"
	const firstSlash = pathWithMethod.indexOf("/");
	// invalid customId
	if (firstSlash <= 0) return false;

	const method = ENCODING_TO_METHOD[pathWithMethod.slice(0, firstSlash)];
	if (method === undefined) return false;
	return {
		method,
		path: pathWithMethod.slice(firstSlash),
	};
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
