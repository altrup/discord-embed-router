export const ID_PREFIX = "der";

// query param that carries a component's `key` option inside its customId;
// reserved: user queryParams can't use it, and it's stripped before routing.
// A PUA character (serialized raw, see Location's query getter) so it costs
// one customId char and can't clash with a plausible user param name; only
// pathnames are PUA-decoded, so it never reaches the encoder
export const KEY_QUERY_PARAM = "\ue000";

export const PUA_START = 0xe000;
export const PUA_END = 0xf8ff;
export const PUA_RANGE = PUA_END - PUA_START + 1;

// Splits a string at every boundary between a run of PUA characters and a
// run of non-PUA characters, without splitting within a PUA run - so a
// multi-character encoded segment (see HashEncoder's segmentLength) stays
// intact as one piece.
export const PUA_RUN_BOUNDARY_PATTERN = new RegExp(
	`(?<=[^${String.fromCodePoint(PUA_START)}-${String.fromCodePoint(PUA_END)}])(?=[${String.fromCodePoint(PUA_START)}-${String.fromCodePoint(PUA_END)}])|(?<=[${String.fromCodePoint(PUA_START)}-${String.fromCodePoint(PUA_END)}])(?=[^${String.fromCodePoint(PUA_START)}-${String.fromCodePoint(PUA_END)}])`,
	"g",
);
