# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Empty select menu submits (deselecting every value) now route to their handler with an empty `values` array, instead of being ignored. Routes whose pattern consumes a selected value (e.g. `/*to`) still ignore empty submits, since there is no value to fill the pattern with.

## [1.0.0] - 2026-07-11

### Added

- Initial stable release.
- `EmbedRouter` with Express-style route registration (`get`/`post`/`put`/`patch`/`delete`/`modal`), multi-method registration via `route(path, handlers)`, and router nesting via `use`.
- Component builders (`RouteButtonBuilder`, `RouteModalBuilder`, and the string/channel/role/user select menu builders) that encode a destination path and query into the component's `customId`.
- Per-message sessions with `get`/`set`/`delete`, scoped by a required `timeout`.
- Cleanup handlers that rewrite a message once its interaction window expires.
- `HashEncoder` for compact `customId` encoding, with a pluggable `Encoder` interface.

[Unreleased]: https://github.com/altrup/discord-embed-router/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/altrup/discord-embed-router/releases/tag/v1.0.0

## Earlier versions

Versions before 1.0.0 were rapid pre-release iterations and are not
individually documented. Their code is available from the corresponding
[npm versions](https://www.npmjs.com/package/discord-embed-router?activeTab=versions).
