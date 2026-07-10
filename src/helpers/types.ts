// Omit distributed over union members: plain Omit collapses a union to its
// common keys (or to {} if undefined is a member), silently dropping every
// per-arm field
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
	? Omit<T, K>
	: never;
