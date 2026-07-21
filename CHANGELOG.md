# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2026-07-20

### Added

- A `route` event on `EmbedRouter`, emitted immediately before each route handler runs (so an attempt that throws still counts): `route: [interaction, info]`, where `info: RouteInfo` carries the `method`, the registered `path` pattern that matched (e.g. `/filter/:scope`, never the resolved path), and the `trigger` — `"interaction"` for a matched component/modal interaction, `"dispatch"` for a `dispatch()` call, `"redirect"` for a hop a previous handler's redirect started (a redirect chain is `"redirect"` from the second hop onward). A throwing `route` listener never breaks handler execution; its error is reported via `routeError` instead.
- `routeError` is extended to `[err, interaction?, info?]`: the same `RouteInfo` is appended when the error came from a matched route's handler, and stays `undefined` for router-internal errors that never reached one. Existing listeners are source-compatible (minor bump).
- `RouteInfo` is exported.

## [1.3.0] - 2026-07-16

### Added

- A `flags` option on `RouteModalBuilder`'s `setTo`/`toOptions` (and on `encodePath`): reply flags (e.g. `Ephemeral`) applied when the modal's submission creates the message it replies with, i.e. when the modal was launched from a slash command. Inert when the submission edits the message the modal was launched from, since creation-time flags can't change. The flags ride in a reserved query param (named by the PUA character `U+E001`, costing 3 chars plus one PUA char per power of 6400 in the masked bitfield — Ephemeral alone is 1) and are stripped before route matching; the value is masked to the reply-settable flags on both encode and decode, so a forged customId can't smuggle other bits. As with `key`, only versions with this change strip the param: a rolled-back bot passes it through to handlers.

### Changed

- `dispatch` rejects `flags` combined with `method: "MODAL"` at the type level (modals accept no flags; carry them on the modal via `setTo`'s `flags` option instead). The runtime `ConfigError` for JS callers remains.

## [1.2.0] - 2026-07-12

### Added

- A `key` option on every component builder's `toOptions`/`patternOptions` (and on `encodePath`). Like React's `key` prop, it disambiguates components that would otherwise encode identical `customId`s, which Discord rejects within one message. The key rides in a reserved query param (named by the PUA character `U+E000`, so it costs `key.length + 3` chars of customId budget) and is stripped before route matching, so handlers never see it; user query params with that name are rejected with a `ConfigError`. Note that only 1.2.0+ strips the param: a bot rolled back to an older version passes it through to handlers of keyed components.

### Changed

- Query params in `customId`s are serialized compactly: only characters that would corrupt parsing (`%`, `&`, `=`, `+`, `#`, tab, newline, carriage return) are percent-encoded, everything else is emitted raw instead of form-urlencoded (e.g. `q=:ts` was `q=%3Ats`, and non-ASCII values no longer triple in size). Decoding is unchanged, so `customId`s minted by earlier versions still route.

## [1.1.0] - 2026-07-12

### Changed

- Empty select menu submits (deselecting every value) now route to their handler with an empty `values` array, instead of being ignored. Routes whose pattern consumes a selected value (e.g. `/*to`) still ignore empty submits, since there is no value to fill the pattern with; use an optional param (e.g. `/{*to}`, `/users{/:userId}`) to receive empty submits on those routes too.

## [1.0.0] - 2026-07-11

### Added

- Initial stable release.
- `EmbedRouter` with Express-style route registration (`get`/`post`/`put`/`patch`/`delete`/`modal`), multi-method registration via `route(path, handlers)`, and router nesting via `use`.
- Component builders (`RouteButtonBuilder`, `RouteModalBuilder`, and the string/channel/role/user select menu builders) that encode a destination path and query into the component's `customId`.
- Per-message sessions with `get`/`set`/`delete`, scoped by a required `timeout`.
- Cleanup handlers that rewrite a message once its interaction window expires.
- `HashEncoder` for compact `customId` encoding, with a pluggable `Encoder` interface.

[Unreleased]: https://github.com/altrup/discord-embed-router/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/altrup/discord-embed-router/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/altrup/discord-embed-router/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/altrup/discord-embed-router/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/altrup/discord-embed-router/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/altrup/discord-embed-router/releases/tag/v1.0.0

## Earlier versions

Versions before 1.0.0 were rapid pre-release iterations and are not
individually documented. Their code is available from the corresponding
[npm versions](https://www.npmjs.com/package/discord-embed-router?activeTab=versions).
