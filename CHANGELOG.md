# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A `key` option on every component builder's `toOptions`/`patternOptions` (and on `encodePath`). Like React's `key` prop, it disambiguates components that would otherwise encode identical `customId`s, which Discord rejects within one message. The key rides in the reserved `_k` query param and is stripped before route matching, so handlers never see it; user query params named `_k` are rejected with a `ConfigError`.

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

[Unreleased]: https://github.com/altrup/discord-embed-router/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/altrup/discord-embed-router/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/altrup/discord-embed-router/releases/tag/v1.0.0

## Earlier versions

Versions before 1.0.0 were rapid pre-release iterations and are not
individually documented. Their code is available from the corresponding
[npm versions](https://www.npmjs.com/package/discord-embed-router?activeTab=versions).
