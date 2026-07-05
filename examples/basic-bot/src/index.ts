// data is updated basically in every file
import {
	ChatInputCommandInteraction,
	Client,
	Collection,
	MessageFlags,
} from "discord.js";
import { DISCORD_GUILD_ID, DISCORD_TOKEN } from "@config";
import { commands as commandsArray } from "@commands";
import {
	CommandImplementation,
	CommandName,
	isCommandName,
} from "@commands/types";
import { router } from "@routes";

const client = new Client({
	intents: [],
	partials: [],
});

// load commands
const commands = new Collection<string, CommandImplementation>();
for (const command of commandsArray) {
	commands.set(command.data.name, command);
}
const commandIds = new Collection<CommandName, string>();

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
	const locals = {
		commandIds,
	};

	// ===== THIS IS REQUIRED TO USE ROUTEBUTTONBUILDER =====
	if (interaction.isButton() || interaction.isAnySelectMenu()) {
		await router.listener(interaction, locals).catch(console.error);
	}

	if (interaction.isCommand()) {
		const command = commands.get(interaction.commandName);

		if (!command) return;

		try {
			if (interaction instanceof ChatInputCommandInteraction) {
				await command.execute(interaction, locals);
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
