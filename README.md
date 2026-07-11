# discord-embed-router

[![npm version](https://img.shields.io/npm/v/discord-embed-router.svg?maxAge=3600)](https://www.npmjs.com/package/discord-embed-router)
[![license](https://img.shields.io/npm/l/discord-embed-router.svg?maxAge=3600)](LICENSE)

An [Express](https://expressjs.com)-inspired, URL-path-based router for [discord.js](https://discord.js.org) interactions. Define routes once, render an embed for each, and get buttons/select menus/modals that "link" to them for free — no more hand-rolled `customId` parsing.

## Why

Handling Discord message components usually means switching on `customId` strings by hand, threading state through them yourself, and hoping two features never pick the same prefix. `discord-embed-router` treats your bot's UI like a tiny web app instead:

- **Routes** — register a path (`/catalog/:id`) and a handler that returns the embed/components to render, the same way you'd write an Express route and its response.
- **Component builders** — `RouteButtonBuilder`, `RouteStringSelectMenuBuilder`, `RouteModalBuilder`, etc. encode the destination path/query into the component's `customId` for you.
- **Sessions** — attach per-message state that persists across clicks without you managing a cache.
- **Cleanup/timeout** — declare what a stale component should turn into once its window expires.

## Install

```bash
npm install discord-embed-router discord.js
```

`discord.js` is a peer dependency — you bring your own compatible version (see `peerDependencies` in [`package.json`](package.json) for the supported range).

## Quick start

```ts
import { EmbedRouter, RouteButtonBuilder } from "discord-embed-router";
import { ActionRowBuilder, ButtonStyle, Client, EmbedBuilder } from "discord.js";

const client = new Client({ intents: [] });
const router = new EmbedRouter(client);
router.onError(console.error);

router.get("/counter", (embedRouter, interaction, state) => {
  const value = parseInt(state.queryParams.get("value") ?? "0");

  return {
    embeds: [new EmbedBuilder().setTitle("Counter").setDescription(`${value}`)],
    components: [
      new ActionRowBuilder()
        .addComponents(
          new RouteButtonBuilder(embedRouter)
            .setLabel("+1")
            .setStyle(ButtonStyle.Success)
            .setTo("/counter", { query: { value: `${value + 1}` } }),
        )
        .toJSON(),
    ],
  };
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "counter") {
    await router.dispatch(interaction, "/counter");
  }
});

client.login(process.env.DISCORD_TOKEN);
```

Clicking "+1" fires an `interactionCreate` the router recognizes by its `customId` prefix, re-runs the `/counter` handler with the new `value`, and updates the message in place — no manual routing code needed.

See [`examples/basic-bot`](examples/basic-bot) for a full bot with multiple routes, a catalog page, and command wiring.

## Core concepts

### Routes

`router.get/post/put/patch/delete(path, handler)` registers a handler for a path, using [`path-to-regexp`](https://github.com/pillarjs/path-to-regexp) syntax for params (`/user/:id`). `router.modal(path, handler)` registers a handler that returns a modal to show instead of editing the message. A `GET` handler's return value is the new message content; other methods must return a `redirect` (to a registered `GET` path) or `undefined` (silent ack).

Routers can be nested with `router.use(prefix, subRouter)`, mirroring how you'd compose an Express app.

### Component builders

`RouteButtonBuilder`, `RouteStringSelectMenuBuilder`, `RouteChannelSelectMenuBuilder`, `RouteRoleSelectMenuBuilder`, `RouteUserSelectMenuBuilder`, and `RouteModalBuilder` extend their discord.js counterparts, replacing `setCustomId`/`setURL` with `.setTo(path, { method, query })`. The router encodes the path into a compact `customId` and decodes it back on click.

### Sessions

Pass a `Session` type parameter to `EmbedRouter<Globals, Session, Locals>` and use `state.session.get()/set()/delete()` inside a handler to keep state tied to a message across multiple interactions (e.g. a multi-step form). Any handler that sets a session or a `cleanup` must also return a `timeout`, so the router always knows when to give up on stale state.

### Cleanup and timeouts

A `GET` handler can return `{ cleanup, timeout }` alongside its content. If no further interaction lands on that message before `timeout` ms, `cleanup` runs and its return value (if any) is applied to the message — handy for expiring a form or disabling stale buttons.

### Encoding

By default, paths are compacted with `HashEncoder` so `customId`s stay under Discord's 100-character limit even for deeply nested routes. Pass a custom `Encoder` via the `EmbedRouter` constructor if you need different encoding behavior.

## API reference

Full type-level documentation is available via your editor's hover/autocomplete (all exports are documented with TSDoc). Public exports:

- `EmbedRouter`
- `RouteButtonBuilder`, `RouteModalBuilder`, `RouteStringSelectMenuBuilder`, `RouteStringSelectMenuOptionBuilder`, `RouteChannelSelectMenuBuilder`, `RouteRoleSelectMenuBuilder`, `RouteUserSelectMenuBuilder`
- `Encoder`, `HashEncoder`
- `ConfigError`

## License

MIT
