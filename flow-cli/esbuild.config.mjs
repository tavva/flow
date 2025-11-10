// ABOUTME: Build configuration for Flow CLI using esbuild
// ABOUTME: Bundles TypeScript to standalone executable with shebang for Node.js
import esbuild from "esbuild";
import process from "process";

const production = process.argv.includes("production");

const context = await esbuild.context({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node16",
  outfile: "dist/index.js",
  format: "cjs",
  sourcemap: !production,
  minify: production,
  logLevel: "info",
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: [],
});

if (production) {
  await context.rebuild();
  await context.dispose();
  process.exit(0);
} else {
  console.log("Watching for changes...");
  await context.watch();
}
