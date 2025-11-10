import esbuild from "esbuild";

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
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: [],
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  console.log("Watching for changes...");
  await context.watch();
}
