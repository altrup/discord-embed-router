import { defineConfig } from "tsup";

export default defineConfig({
	format: ["cjs"],
	entry: ["src/index.ts", "src/deploy-commands.ts"],
	splitting: false,
	sourcemap: false,
	clean: true,
});
