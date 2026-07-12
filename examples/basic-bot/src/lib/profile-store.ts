import { readFileSync, writeFileSync } from "node:fs";

export type Profile = { visits: number; lastVisit: number };

// Stand-in for a real database client (e.g. Supabase or Postgres). The bot
// injects it into routes through setLocalsProvider, so handlers depend on
// this narrow interface rather than a concrete database.
export class ProfileStore {
	#file: string;
	#profiles: Record<string, Profile>;

	constructor(file: string) {
		this.#file = file;
		try {
			this.#profiles = JSON.parse(readFileSync(file, "utf8")) as Record<
				string,
				Profile
			>;
		} catch {
			this.#profiles = {};
		}
	}

	// async to mirror a real database call, so swapping one in doesn't
	// change the routes that use this store
	async getProfile(userId: string): Promise<Profile | undefined> {
		return this.#profiles[userId];
	}

	async recordVisit(userId: string): Promise<Profile> {
		const profile: Profile = {
			visits: (this.#profiles[userId]?.visits ?? 0) + 1,
			lastVisit: Date.now(),
		};
		this.#profiles[userId] = profile;
		writeFileSync(this.#file, JSON.stringify(this.#profiles, null, "\t"));
		return profile;
	}
}
