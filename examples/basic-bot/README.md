# Discord Embed Router Example Bot

A Discord bot that showcases how to use [`discord-embed-router`](../..).

It registers two slash commands:

- `/help`: a minimal single-route page.
- `/catalog`: a browsable catalog of demo pages, each showing a different feature:

| Page        | Demonstrates                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Counter     | Sessions, `POST`/`PUT` mutations with redirects, and a modal for direct input (`routes/counter.ts`)        |
| User info   | Path params (`/user-info/{:userId}`) and select menu builders (`routes/user-info.ts`)                      |
| Timer       | Cleanup/timeout turning a stale message into an expired state (`routes/timer.ts`)                          |
| Tic-tac-toe | A multi-method page registered with `router.route()`, driven entirely by buttons (`routes/tic-tac-toe.ts`) |

Route wiring lives in [`src/routes/index.ts`](src/routes/index.ts), including a nested router mounted at `/catalog`.

## Setup

### Prerequisites

- Node (version in the repo root's `.nvmrc`)
- A Discord bot ([guide](https://discordjs.guide/legacy/preparations/app-setup))

### Usage

- Install dependencies and build the library (the example consumes the local package through its built output), from the repo root:

  ```bash
  npm install
  npm run build
  ```

- Enter this folder

  ```bash
  cd examples/basic-bot
  ```

- Copy [`.env.example`](.env.example) to `.env` and fill in the values (`DISCORD_GUILD_ID` is optional; setting it deploys commands to that server instantly instead of globally)

  ```bash
  cp .env.example .env
  ```

- Deploy commands

  ```bash
  npm run deploy-commands
  ```

- Start the bot with hot reloading

  ```bash
  npm run dev
  ```

- Invite the bot to your server ([guide](https://discordjs.guide/legacy/preparations/adding-your-app)), then run `/help` or `/catalog`
