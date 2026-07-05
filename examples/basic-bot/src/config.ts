import * as dotenv from "dotenv";

dotenv.config({ quiet: true });

if (
	process.env.DISCORD_TOKEN === undefined ||
	process.env.DISCORD_CLIENT_ID === undefined
) {
	throw new Error("Missing environment variables");
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

export { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID };
