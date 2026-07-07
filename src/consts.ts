export const ID_PREFIX = "der";

export const PUA_START = 0xe000;
export const PUA_END = 0xf8ff;
export const PUA_RANGE = PUA_END - PUA_START + 1;

export const PUA_SPLIT_PATTERN = new RegExp(
	`(?=[${String.fromCodePoint(PUA_START)}-${String.fromCodePoint(PUA_END)}])|(?<=[${String.fromCodePoint(PUA_START)}-${String.fromCodePoint(PUA_END)}])(?=[^${String.fromCodePoint(PUA_START)}-${String.fromCodePoint(PUA_END)}])`,
	"g",
);
