// ABOUTME: Build configuration for Flow CLI using esbuild
// ABOUTME: Bundles TypeScript to standalone executable with shebang for Node.js
import esbuild from "esbuild";
import process from "process";
import { chmod } from "fs/promises";

const production = process.argv.includes("production");

// Plugin to make output executable
const makeExecutablePlugin = {
  name: "make-executable",
  setup(build) {
    build.onEnd(async () => {
      await chmod("dist/index.js", 0o755);
    });
  },
};

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
  plugins: [makeExecutablePlugin],
});

if (production) {
  await context.rebuild();
  await context.dispose();
  process.exit(0);
} else {
  console.log("Watching for changes...");
  await context.watch();
}
