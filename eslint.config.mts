// outside tsconfig's rootDir, so VS Code's inferred project can't see
// @types/node; ESLint itself type-checks this fine via its own
// tsconfigRootDir/project resolution.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const tsconfigRootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig([
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
		plugins: { js },
		extends: ["js/recommended"],
		languageOptions: { globals: globals.browser },
	},
	{ files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
	tseslint.configs.recommended,
	{
		languageOptions: {
			parserOptions: { tsconfigRootDir },
		},
	},
	{
		ignores: ["dist/", "node_modules/", "examples/"],
	},
]);
