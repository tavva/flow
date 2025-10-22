import esbuild from "esbuild";

// Plugin to stub out react-devtools-core
const stubDevtools = {
	name: 'stub-devtools',
	setup(build) {
		build.onResolve({ filter: /^react-devtools-core$/ }, () => {
			return { path: 'react-devtools-core', namespace: 'stub-ns' };
		});
		build.onLoad({ filter: /.*/, namespace: 'stub-ns' }, () => {
			return {
				contents: 'export default { connectToDevTools: () => {} };',
				loader: 'js'
			};
		});
	}
};

const result = await esbuild.build({
	entryPoints: ['src/cli.tsx'],
	bundle: true,
	platform: 'node',
	target: 'node20',
	format: 'esm',
	outfile: 'dist/cli.mjs',
	packages: 'external',
	plugins: [stubDevtools],
	alias: {
		'obsidian': './src/obsidian-compat.ts'
	},
	define: {
		'process.env.DEV': 'false',
		'process.env.NODE_ENV': '"production"'
	},
	logLevel: "info",
	sourcemap: false,
	treeShaking: true,
	banner: {
		js: '#!/usr/bin/env node\n',
	},
});

process.exit(result.errors.length > 0 ? 1 : 0);
