// data is updated basically in every file
import { join } from "node:path";

import { commands as commandsArray } from "@commands";
import {
	CommandImplementation,
	CommandName,
	isCommandName,
} from "@commands/types";
import { DISCORD_GUILD_ID, DISCORD_TOKEN } from "@config";
import { registerRoutes } from "@routes";
import { EmbedRouter } from "discord-embed-router";
import {
	ChatInputCommandInteraction,
	Client,
	Collection,
	MessageFlags,
} from "discord.js";

import { ProfileStore } from "@lib/profile-store";
import { Globals, Locals, Session } from "@routes/types";

const client = new Client({
	intents: [],
	partials: [],
});

// set up embed router
const router = new EmbedRouter<Globals, Session, Locals>(client);
// listen to discord-embed-router errors and warnings
router.onError(console.error);
process.on("warning", console.error);

// inject persistent-data access into every route via state.locals; the
// provider must be synchronous, so it hands routes the store itself and
// they await their own queries
const profileStore = new ProfileStore(join(__dirname, "../profiles.json"));
router.setLocalsProvider(() => ({ profiles: profileStore }));

registerRoutes(router);

// load commands
const commands = new Collection<string, CommandImplementation>();
for (const command of commandsArray) {
	commands.set(command.data.name, command);
}
const commandIds = new Collection<CommandName, string>();

const globals = {
	commandIds,
};
router.setGlobals(globals);

// When the client is ready, set status
client.once("clientReady", async () => {
	console.log("Ready");
	client.user?.setPresence({
		activities: [{ name: "/help", type: 3 }],
		status: "online",
	});

	(DISCORD_GUILD_ID
		? await (await client.guilds.fetch(DISCORD_GUILD_ID)).commands.fetch()
		: await client.application?.commands.fetch()
	)?.forEach((command, key) => {
		if (isCommandName(command.name)) {
			commandIds.set(command.name, key);
		} else {
			console.error("Unknown command was registered: ", command.name);
		}
	});
});
client.on("shardResume", () => {
	client.user?.setPresence({
		activities: [{ name: "/help", type: 3 }],
		status: "online",
	});
});

client.on("interactionCreate", async (interaction) => {
	if (interaction.isCommand()) {
		const command = commands.get(interaction.commandName);

		if (!command) return;

		try {
			if (interaction instanceof ChatInputCommandInteraction) {
				await command.execute(router, interaction, globals);
			}
		} catch (error) {
			console.error(error);
			await interaction.reply({
				content: "There was an error while executing this command!",
				flags: [MessageFlags.Ephemeral],
			});
		}
	}
});

// wait until online to log in
// otherwise program will error out
// NOTE: dynamic import is required here
import("is-online").then(({ default: isOnline }) => {
	const checkOnline = async () => {
		console.log("Checking for internet...");
		if (await isOnline()) {
			console.log("Online. Connecting to server");
			client.login(DISCORD_TOKEN);
		} else {
			console.log("Offline. Checking again in 5 seconds");
			setTimeout(checkOnline, 5000);
		}
	};
	checkOnline();
});
