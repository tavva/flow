# CLI Architecture and Build Setup

This document explains the technical architecture of the standalone CLI and the build setup required to run Obsidian plugin code outside of the Obsidian environment.

## Overview

The Flow GTD Coach CLI (`src/cli.tsx`) allows using the GTD coaching functionality from the command line without running Obsidian. This presents several technical challenges:

1. The codebase imports Obsidian API types and classes
2. Most of the codebase expects to run inside Obsidian's plugin environment
3. The CLI uses React/Ink which has ESM-specific dependencies (yoga-layout with top-level await)
4. TypeScript imports don't include `.js` extensions (required for true ESM)

## Build System

### Dual Build Configuration

The project has two separate esbuild configurations:

1. **`esbuild.config.mjs`** - Builds the Obsidian plugin (`main.ts` → `main.js`)
   - Output format: CommonJS (required by Obsidian)
   - Bundles everything except Obsidian API
   - Target: ES2018

2. **`esbuild.cli.mjs`** - Builds the standalone CLI (`src/cli.tsx` → `dist/cli.mjs`)
   - Output format: ESM (required for yoga-layout/Ink)
   - External packages: All node_modules (uses `packages: 'external'`)
   - Stubs Obsidian API via alias
   - Target: Node 20

### Why ESM for CLI?

The CLI must be built as ESM because:

- Ink v5 depends on yoga-layout v3.2+
- yoga-layout uses top-level await: `const Yoga = wrapAssembly(await loadYoga());`
- Top-level await is not supported in CommonJS
- tsx/ts-node cannot transform this away without breaking the module

### Build Commands

```bash
# Build the CLI
npm run build:cli

# Run the CLI
npm run cli -- --vault /path/to/vault --sphere work

# Or run directly
./dist/cli.mjs --vault /path/to/vault --sphere work
```

## Obsidian API Compatibility Layer

### The Problem

The codebase extensively imports from `obsidian`:

```typescript
import { TFile, App, CachedMetadata } from "obsidian";
```

These imports fail outside Obsidian:

1. Type-only imports work fine (transpiled away)
2. Runtime imports (like `TFile` for instanceof checks) fail
3. The `obsidian` package is not available in node_modules

### The Solution: `src/obsidian-compat.ts`

This file provides minimal implementations of Obsidian types for CLI usage:

```typescript
// Minimal TFile implementation for CLI
export class TFile {
  path: string;
  basename: string;
  extension: string;
  name: string;
  parent: any;
  vault: any;
  stat: { ctime: number; mtime: number; size: number };

  constructor(data: { path: string; basename: string; extension: string }) {
    this.path = data.path;
    this.basename = data.basename;
    this.extension = data.extension;
    this.name = `${data.basename}.${data.extension}`;
    this.parent = null;
    this.vault = null;
    this.stat = { ctime: 0, mtime: 0, size: 0 };
  }
}
```

### esbuild Alias Configuration

The build configuration uses esbuild's alias feature to redirect obsidian imports:

```javascript
// esbuild.cli.mjs
alias: {
  'obsidian': './src/obsidian-compat.ts'
}
```

This means when code imports from `'obsidian'`, esbuild resolves it to our compatibility layer instead.

**Important**: Runtime imports (not type-only) must be used for classes that need instanceof checks:

```typescript
// ✅ CORRECT - Runtime import for instanceof
import { TFile } from "obsidian";

// ❌ WRONG - Type-only import won't be in runtime
import type { TFile } from "obsidian";
```

## MockApp Architecture

### Overview

The CLI creates a mock Obsidian app that implements just enough of the Obsidian API to support the GTD scanning and processing code.

### Key Classes in `src/cli.tsx`

#### MockVault

Implements `vault` API using Node.js filesystem:

```typescript
class MockVault {
  private vaultPath: string;

  getMarkdownFiles(): TFile[] {
    // Recursively walks vaultPath directory
    // Creates TFile instances for each .md file
  }

  async read(file: TFile): Promise<string> {
    // Reads file contents using fs
  }

  getAbstractFileByPath(filePath: string): TFile | null {
    // Returns TFile instance for path
  }
}
```

**Critical Implementation Detail**: MockVault must return actual `TFile` instances (not plain objects) for instanceof checks to work:

```typescript
// ✅ CORRECT
const tfile = new TFile({
  path: relativePath,
  basename: entry.name.replace(".md", ""),
  extension: "md",
});
files.push(tfile);

// ❌ WRONG - instanceof checks will fail
files.push({
  path: relativePath,
  basename: entry.name.replace(".md", ""),
  extension: "md",
} as TFile);
```

#### MockMetadataCache

Implements `metadataCache` API by parsing frontmatter:

```typescript
class MockMetadataCache {
  private vault: MockVault;

  getFileCache(file: TFile): CachedMetadata | null {
    // Reads file, extracts frontmatter
    // Parses YAML to get metadata
  }
}
```

#### MockApp

Combines vault and metadata cache:

```typescript
class MockApp {
  vault: MockVault;
  metadataCache: MockMetadataCache;

  constructor(vaultPath: string) {
    this.vault = new MockVault(vaultPath);
    this.metadataCache = new MockMetadataCache(this.vault);
  }
}
```

### Usage in CLI Code

The main function creates MockApp and passes it to scanners:

```typescript
const mockApp = new MockApp(args.vaultPath);

// Scanners work with MockApp just like they would with real Obsidian App
const scanner = new FlowProjectScanner(mockApp as any);
const projects = scanner.scanVault();
```

The `as any` cast is needed because MockApp doesn't implement the full App interface, just the parts we need.

## Common Issues and Solutions

### Issue: "TFile is not defined"

**Cause**: Only type imports of TFile, no runtime import

**Solution**: Add runtime import alongside type import:

```typescript
import type { App, CachedMetadata } from "obsidian";
import { TFile } from "obsidian"; // Runtime import
```

### Issue: "instanceof TFile" always returns false

**Cause**: MockVault returning plain objects instead of TFile instances

**Solution**: Always construct actual TFile instances:

```typescript
const tfile = new TFile({ path, basename, extension });
return tfile;
```

### Issue: "Cannot find module 'obsidian'"

**Cause**: esbuild alias not working or packages not external

**Solution**: Check esbuild.cli.mjs has:

```javascript
packages: 'external',
alias: { 'obsidian': './src/obsidian-compat.ts' }
```

### Issue: "Dynamic require not supported"

**Cause**: esbuild bundling CommonJS node_modules in ESM output

**Solution**: Use `packages: 'external'` to avoid bundling node_modules

### Issue: "Top-level await not supported"

**Cause**: Trying to output CommonJS format with ESM dependencies

**Solution**: Use `format: 'esm'` in build configuration

### Issue: "require.main === module" fails

**Cause**: CommonJS pattern doesn't work in ESM

**Solution**: Use ESM equivalent:

```typescript
// ESM check
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

## Testing MockApp Changes

When modifying MockApp or the compatibility layer:

1. Build the CLI: `npm run build:cli`
2. Test with a real vault: `./dist/cli.mjs --vault ~/path/to/vault --sphere work`
3. Verify vault statistics are correct
4. Test tool execution (focus add, action updates)

## Adding New Obsidian API Dependencies

If new code imports additional Obsidian types/classes:

1. Add type-only imports as normal (transpiled away)
2. For runtime classes, add minimal implementation to `obsidian-compat.ts`
3. If needed by MockApp, implement in appropriate Mock class
4. Test that instanceof checks work correctly

## Build Artifacts

- `dist/cli.mjs` - Standalone ESM bundle (~75kb with packages external)
- Executable via `#!/usr/bin/env node` shebang
- Requires node_modules to be installed (dependencies not bundled)

## Dependencies

The CLI relies on these key dependencies:

- **Ink** (v5.2.1) - React for terminals, requires ESM
- **yoga-layout** (v3.2.1) - Ink dependency, uses top-level await
- **marked + marked-terminal** - Markdown rendering in terminal
- **React** - Required by Ink

All dependencies are external in the bundle and loaded from node_modules at runtime.
