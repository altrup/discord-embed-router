import { AnySelectMenuInteraction, ButtonInteraction } from "discord.js";
import { expect, test } from "vitest";

import { Encoder } from "@encoding/Encoder";
import { InteractionDecoder } from "@routing/InteractionDecoder";
import { ID_PREFIX } from "@src/consts";

const mockButtonInteraction = (customId: string): ButtonInteraction =>
	({
		customId,
		createdTimestamp: 1700000000000,
		isMessageComponent: () => true,
		isButton: () => true,
		isAnySelectMenu: () => false,
	}) as unknown as ButtonInteraction;

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
		isStringSelectMenu: () => false,
		isChannelSelectMenu: () => false,
		isRoleSelectMenu: () => false,
		isUserSelectMenu: () => false,
		...overrides,
	}) as unknown as AnySelectMenuInteraction;

test("decode() returns false when the customId doesn't start with idPrefix", () => {
	const decoder = new InteractionDecoder(new Encoder());
	const interaction = mockButtonInteraction("not-prefixed");

	expect(decoder.decode(interaction, ID_PREFIX)).toBe(false);
});

test("decode() returns false when the encoder can't decode the path", () => {
	const decoder = new InteractionDecoder(new Encoder());
	// correct prefix, but no valid method-encoding character after it
	const interaction = mockButtonInteraction(`${ID_PREFIX}!garbage`);

	expect(decoder.decode(interaction, ID_PREFIX)).toBe(false);
});

test("decode() decodes a button's customId and fills :ts from createdTimestamp", () => {
	const encoder = new Encoder();
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

test("decode() returns false for a select menu with no selected values", () => {
	const encoder = new Encoder();
	encoder.registerPath("/*to");
	const customId = encoder.encodePath("/*to", {
		method: "GET",
		idPrefix: ID_PREFIX,
	});

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockSelectMenuInteraction({ customId, values: [] });

	expect(decoder.decode(interaction, ID_PREFIX)).toBe(false);
});

test("decode() fills :to on a string select menu from the chosen value's path", () => {
	const encoder = new Encoder();
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
	});
});

test("decode() fills *tos on a string select menu from every chosen value", () => {
	const encoder = new Encoder();
	encoder.registerPath("/multi/*tos");
	encoder.registerPath("/a");
	encoder.registerPath("/b");
	const customId = encoder.encodePath("/multi/*tos", {
		method: "GET",
		idPrefix: ID_PREFIX,
	});
	const valueA = encoder.encodePath<true>("/a", { method: "", idPrefix: "" });
	const valueB = encoder.encodePath<true>("/b", { method: "", idPrefix: "" });

	const decoder = new InteractionDecoder(encoder);
	const interaction = mockSelectMenuInteraction({
		customId,
		values: [valueA, valueB],
		isStringSelectMenu: () => true,
	});

	expect(decoder.decode(interaction, ID_PREFIX)).toStrictEqual({
		method: "GET",
		path: "/multi/a/b",
	});
});

test("decode() fills userId/userIds on a user select menu from the raw selected ids", () => {
	const encoder = new Encoder();
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
	});
});

test("decode() fills channelId/channelIds on a channel select menu", () => {
	const encoder = new Encoder();
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
	});
});

test("decode() fills roleId/roleIds on a role select menu", () => {
	const encoder = new Encoder();
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
	});
});
