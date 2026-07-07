import { METHOD_ENCODINGS } from "./consts";

export type MethodEncoding = (typeof METHOD_ENCODINGS)[number];
export const isMethodEncoding = (char: string): char is MethodEncoding => {
	return METHOD_ENCODINGS.includes(char as MethodEncoding);
};
