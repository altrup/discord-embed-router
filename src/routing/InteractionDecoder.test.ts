import {
	AnySelectMenuInteraction,
	ButtonInteraction,
	ModalSubmitInteraction,
} from "discord.js";
import { expect, test } from "vitest";

import { HashEncoder } from "@encoding/HashEncoder";
import { InteractionDecoder } from "@routing/InteractionDecoder";
import { ID_PREFIX } from "@src/consts";

const mockButtonInteraction = (customId: string): ButtonInteraction =>
	({
		customId,
		createdTimestamp: 1700000000000,
		isMessageComponent: () => true,
		isButton: () => true,
		isAnySelectMenu: () => false,
		isModalSubmit: () => false,
	}) as unknown as ButtonInteraction;

const mockModalSubmitInteraction = (customId: string): ModalSubmitInteraction =>
	({
		customId,
		createdTimestamp: 1700000000000,
		isMessageComponent: () => false,
		isButton: () => false,
		isAnySelectMenu: () => false,
		isModalSubmit: () => true,
	}) as unknown as ModalSubmitInteraction;

const mockSelectMenuInteraction = (overrides: {
	customId: string;
	values: string[];
	isStringSelectMenu?: () => boolean;
	isChannelSelectMenu?: () => boolean;
	isRoleSelectMenu?: () => boolean;
	isUserSelectMenu?: () => boolean;
}): AnySelectMenuInteraction =>
	({
		createdTimestamp: 1700000000000,
		isMessageComponent: () => true,
		isButton: () => false,
		isAnySelectMenu: () => true,
		isModalSubmit: () => false,
		isStringSelectMenu: () => false,
		isChannelSelectMenu: () => false,
		isRoleSelectMenu: () => false,
		isUserSelectMenu: () => false,
		...overrides,
	}) as unknown as AnySelectMenuInteraction;

test("decode() returns false when the customId doesn't start with idPrefix", () => {
	const decoder = new InteractionDecoder(new HashEncoder());
	const interaction = mockButtonInteraction("not-prefixed");

	expect(decoder.decode(interaction, ID_PREFIX)).toBe(false);
});

test("decode() returns false when the encoder can't decode the path", () => {
	const decoder = new InteractionDecoder(new HashEncoder());
	// correct prefix, but no valid method-encoding character after it
	const interaction = mockButtonInteraction(`${ID_PREFIX}!garbage`);

	expect(decoder.decode(interaction, ID_PREFIX)).toBe(false);
});

test("decode() decodes a button's customId and fills :ts from createdTimestamp", () => {
	const encoder = new HashEncoder();
	encoder.registerPath("/greet/:ts");
	const customId = encoder.encodePath("/greet/:ts", {
		method: "GET",
		idPrefix: ID_PREFIX,
	});

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockButtonInteraction(customId);

	expect(decoder.decode(interaction, ID_PREFIX)).toStrictEqual({
		method: "GET",
		path: "/greet/1700000000000",
	});
});

test("decode() decodes a modal submission's customId the same way as a button's", () => {
	const encoder = new HashEncoder();
	encoder.registerPath("/submit/:ts");
	const customId = encoder.encodePath("/submit/:ts", {
		method: "POST",
		idPrefix: ID_PREFIX,
	});

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockModalSubmitInteraction(customId);

	expect(decoder.decode(interaction, ID_PREFIX)).toStrictEqual({
		method: "POST",
		path: "/submit/1700000000000",
	});
});

test("decode() returns false for an empty select menu whose pattern needs a selected value", () => {
	const encoder = new HashEncoder();
	encoder.registerPath("/*to");
	const customId = encoder.encodePath("/*to", {
		method: "GET",
		idPrefix: ID_PREFIX,
	});

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockSelectMenuInteraction({
		customId,
		values: [],
		isStringSelectMenu: () => true,
	});

	expect(decoder.decode(interaction, ID_PREFIX)).toBe(false);
});

test("decode() routes an empty user select menu to its own pattern with empty values", () => {
	const encoder = new HashEncoder();
	encoder.registerPath("/members");
	const customId = encoder.encodePath("/members", {
		method: "POST",
		idPrefix: ID_PREFIX,
	});

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockSelectMenuInteraction({
		customId,
		values: [],
		isUserSelectMenu: () => true,
	});

	expect(decoder.decode(interaction, ID_PREFIX)).toStrictEqual({
		method: "POST",
		path: "/members",
		values: [],
	});
});

test("decode() routes an empty string select menu to its pattern method with empty values", () => {
	const encoder = new HashEncoder();
	encoder.registerPath("/roles/remove");
	const customId = encoder.encodePath("/roles/remove", {
		method: "POST",
		idPrefix: ID_PREFIX,
	});

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockSelectMenuInteraction({
		customId,
		values: [],
		isStringSelectMenu: () => true,
	});

	expect(decoder.decode(interaction, ID_PREFIX)).toStrictEqual({
		method: "POST",
		path: "/roles/remove",
		values: [],
	});
});

test("decode() fills :to on a string select menu from the chosen value's path", () => {
	const encoder = new HashEncoder();
	encoder.registerPath("/*to");
	encoder.registerPath("/help");
	const customId = encoder.encodePath("/*to", {
		method: "GET",
		idPrefix: ID_PREFIX,
	});
	const value = encoder.encodePath<true>("/help", {
		method: "",
		idPrefix: "",
	});

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockSelectMenuInteraction({
		customId,
		values: [value],
		isStringSelectMenu: () => true,
	});

	expect(decoder.decode(interaction, ID_PREFIX)).toStrictEqual({
		method: "GET",
		path: "/help",
		values: ["/help"],
	});
});

test("decode() exposes every chosen value on a string select menu via values, using only the first for :to", () => {
	const encoder = new HashEncoder();
	encoder.registerPath("/multi/*to");
	encoder.registerPath("/a");
	encoder.registerPath("/b");
	const customId = encoder.encodePath("/multi/*to", {
		method: "GET",
		idPrefix: ID_PREFIX,
	});
	const valueA = encoder.encodePath<true>("/a", {
		method: "",
		idPrefix: "",
	});
	const valueB = encoder.encodePath<true>("/b", {
		method: "",
		idPrefix: "",
	});

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockSelectMenuInteraction({
		customId,
		values: [valueA, valueB],
		isStringSelectMenu: () => true,
	});

	expect(decoder.decode(interaction, ID_PREFIX)).toStrictEqual({
		method: "GET",
		path: "/multi/a",
		values: ["/a", "/b"],
	});
});

test("decode() uses an option's own encoded method, overriding the select menu's pattern method", () => {
	const encoder = new HashEncoder();
	encoder.registerPath("/*to");
	encoder.registerPath("/help");
	const customId = encoder.encodePath("/*to", {
		method: "GET",
		idPrefix: ID_PREFIX,
	});
	const value = encoder.encodePath<true>("/help", {
		method: "MODAL",
		idPrefix: "",
	});

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockSelectMenuInteraction({
		customId,
		values: [value],
		isStringSelectMenu: () => true,
	});

	expect(decoder.decode(interaction, ID_PREFIX)).toStrictEqual({
		method: "MODAL",
		path: "/help",
		values: ["/help"],
	});
});

test("decode() falls back to the select menu's pattern method when an option has no method of its own", () => {
	const encoder = new HashEncoder();
	encoder.registerPath("/*to");
	encoder.registerPath("/help");
	const customId = encoder.encodePath("/*to", {
		method: "POST",
		idPrefix: ID_PREFIX,
	});
	const value = encoder.encodePath<true>("/help", {
		method: "",
		idPrefix: "",
	});

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockSelectMenuInteraction({
		customId,
		values: [value],
		isStringSelectMenu: () => true,
	});

	expect(decoder.decode(interaction, ID_PREFIX)).toStrictEqual({
		method: "POST",
		path: "/help",
		values: ["/help"],
	});
});

test("decode() fills userId on a user select menu from the first selected id, exposing the rest via values", () => {
	const encoder = new HashEncoder();
	encoder.registerPath("/user/:userId");
	const customId = encoder.encodePath("/user/:userId", {
		method: "GET",
		idPrefix: ID_PREFIX,
	});

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockSelectMenuInteraction({
		customId,
		values: ["111", "222"],
		isUserSelectMenu: () => true,
	});

	expect(decoder.decode(interaction, ID_PREFIX)).toStrictEqual({
		method: "GET",
		path: "/user/111",
		values: ["111", "222"],
	});
});

test("decode() fills channelId on a channel select menu", () => {
	const encoder = new HashEncoder();
	encoder.registerPath("/channel/:channelId");
	const customId = encoder.encodePath("/channel/:channelId", {
		method: "GET",
		idPrefix: ID_PREFIX,
	});

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockSelectMenuInteraction({
		customId,
		values: ["333"],
		isChannelSelectMenu: () => true,
	});

	expect(decoder.decode(interaction, ID_PREFIX)).toStrictEqual({
		method: "GET",
		path: "/channel/333",
		values: ["333"],
	});
});

test("decode() fills roleId on a role select menu", () => {
	const encoder = new HashEncoder();
	encoder.registerPath("/role/:roleId");
	const customId = encoder.encodePath("/role/:roleId", {
		method: "GET",
		idPrefix: ID_PREFIX,
	});

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockSelectMenuInteraction({
		customId,
		values: ["444"],
		isRoleSelectMenu: () => true,
	});

	expect(decoder.decode(interaction, ID_PREFIX)).toStrictEqual({
		method: "GET",
		path: "/role/444",
		values: ["444"],
	});
});
