# Flow CLI Quick Capture Design

**Date:** 2025-11-10
**Status:** Design Complete

## Overview

A standalone CLI tool for capturing quick thoughts to a Flow inbox file. Users run `flow "buy milk"` from anywhere, and the text appends to their configured inbox file.

## Goals

- Capture text from terminal in one command
- Write to inbox file configured in Flow plugin settings
- Require minimal user interaction
- Provide clear error messages

## Architecture

### Standalone Package

The CLI ships as a standalone npm package (`@flow/cli` or `flow-cli`), installed globally. It reads the Flow plugin's settings but runs independently of Obsidian.

**Why standalone?**

- Works from any terminal location
- Installs easily with npm global install
- Doesn't require Obsidian to be running

**Package structure:**

```
flow-cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # Entry point, argument parsing
│   ├── config.ts         # Config file management
│   ├── plugin-settings.ts # Plugin settings reader
│   ├── capture.ts        # File append logic
│   └── types.ts          # TypeScript types
├── dist/
│   └── index.js          # Built bundle
└── tests/
    └── *.test.ts
```

### Configuration

**CLI config** (`~/.config/flow-cli/config.json`):

```json
{
  "defaultVault": "/Users/ben/Obsidian/MyVault"
}
```

The CLI reads this file to find the vault. Users set this value during first run or via `--config` flag.

**Plugin settings** (`<vault>/.obsidian/plugins/flow/data.json`):

```json
{
  "cliInboxFile": "Flow CLI Inbox.md",
  ...
}
```

The plugin settings specify where to write captures. The CLI reads this value from the vault's plugin settings.

### Data Flow

1. User runs: `flow "buy milk"`
2. CLI reads config from `~/.config/flow-cli/config.json`
3. If no default vault configured, prompt user and save to config
4. Read plugin settings from `<vault>/.obsidian/plugins/flow/data.json`
5. Extract `cliInboxFile` path
6. Append text to `<vault>/<cliInboxFile>` (create file if missing)
7. Print confirmation: `Captured: "buy milk"`

## CLI Interface

### Command Usage

```bash
# First run - prompts for vault path and saves to config
flow "buy milk"
# No default vault configured.
# Enter vault path: ~/Obsidian/MyVault
# Saving default vault to ~/.config/flow-cli/config.json
# Captured: "buy milk"

# Subsequent runs - uses saved default
flow "buy milk"
# Captured: "buy milk"

# Override default vault
flow --vault ~/Obsidian/Work "meeting notes"
# Captured: "meeting notes"

# Reconfigure default vault
flow --config
# Enter vault path: ~/Obsidian/Personal
# Saved default vault to ~/.config/flow-cli/config.json
```

### Arguments

- **Positional argument** (required): Text to capture
- **`--vault <path>`** (optional): Vault path, overrides default
- **`--config`** (optional): Interactive setup to configure default vault

### File Format

The CLI appends plain text lines to the inbox file:

```
buy milk
call dentist
meeting notes
```

No timestamps, no checkboxes - just text. This keeps the implementation simple and lets the Flow plugin process the inbox however it wants.

New captures append to the bottom of the file (chronological order).

## Error Handling

All errors write to stderr and exit with code 1.

### User Errors

**No text provided:**

```
Error: Please provide text to capture
Usage: flow "your text here"
```

**Vault doesn't exist:**

```
Error: Vault not found at /Users/ben/Obsidian/MyVault
```

**Not a valid vault:**

```
Error: Not a valid Obsidian vault (missing .obsidian folder): /Users/ben/Obsidian/MyVault
```

**Plugin not installed:**

```
Error: Flow plugin not installed at /Users/ben/Obsidian/MyVault/.obsidian/plugins/flow
```

**Settings unreadable:**

```
Error: Could not read Flow plugin settings
```

**CLI inbox file not configured:**

```
Error: cliInboxFile not configured in Flow plugin settings
Please open Obsidian and configure: Settings → Flow GTD Coach → CLI Inbox File
```

**Write failed:**

```
Error: Could not write to inbox file: [system error message]
```

### Success Output

```
Captured: "buy milk"
```

Output goes to stdout for visibility. Future features could pipe text to other commands if needed.

## Implementation Details

### Dependencies

**Runtime:** None - use Node.js built-ins only

- `fs` - File system operations
- `path` - Path manipulation
- `readline` - Interactive prompts

**Dev dependencies:**

- TypeScript
- esbuild
- Jest
- Prettier

This matches the Flow plugin's tooling for consistency.

### Build Process

esbuild bundles `src/index.ts` to `dist/index.js` with:

- Shebang: `#!/usr/bin/env node`
- Target: Node.js 16+ (Obsidian's Electron version)
- Single bundle (no external dependencies)

`package.json` configuration:

```json
{
  "name": "@flow/cli",
  "bin": {
    "flow": "./dist/index.js"
  }
}
```

Users install globally: `npm install -g @flow/cli`

### Module Breakdown

**`index.ts`** - Entry point

- Parse command-line arguments
- Read or create config file
- Call plugin settings reader
- Call capture function
- Handle errors and print messages

**`config.ts`** - Config management

- `readConfig(): Config | null` - Read `~/.config/flow-cli/config.json`
- `writeConfig(config: Config): void` - Write config file
- `promptForVaultPath(): Promise<string>` - Interactive prompt
- Creates `~/.config/flow-cli/` directory if missing

**`plugin-settings.ts`** - Plugin settings reader

- `readPluginSettings(vaultPath: string): PluginSettings` - Read and parse data.json
- Validates vault has `.obsidian/plugins/flow/data.json`
- Throws specific errors for missing files or invalid JSON
- Extracts `cliInboxFile` setting

**`capture.ts`** - File operations

- `capture(vaultPath: string, inboxFile: string, text: string): void`
- Resolves inbox file path relative to vault
- Creates parent directories if needed
- Appends text with newline
- Creates file if doesn't exist

**`types.ts`** - Type definitions

```typescript
interface Config {
  defaultVault: string;
}

interface PluginSettings {
  cliInboxFile: string;
  [key: string]: unknown;
}
```

## Testing Strategy

Jest tests with 80% coverage target (matching Flow plugin standards).

### Unit Tests

**`config.test.ts`**

- Read existing config file
- Write new config file
- Create config directory if missing
- Handle missing or invalid JSON
- Interactive prompt flow

**`plugin-settings.test.ts`**

- Read plugin data.json successfully
- Handle missing `.obsidian` folder
- Handle missing plugin folder
- Handle missing or invalid data.json
- Handle missing `cliInboxFile` setting
- Throw appropriate errors for each case

**`capture.test.ts`**

- Append text to existing file
- Create new file if missing
- Create parent directories if needed
- Resolve paths relative to vault
- Handle file permission errors
- Handle disk full errors

**`index.test.ts`** (integration-style)

- Full capture flow with mocked filesystem
- Argument parsing for all flags
- Config setup on first run
- Error messages for all error cases
- Vault path override with `--vault`

### Manual Testing

After building:

1. Install globally: `npm install -g .`
2. Run first-time setup: `flow "test capture"`
3. Verify config file created in `~/.config/flow-cli/`
4. Verify text appended to inbox file
5. Test with missing plugin settings
6. Test with invalid vault path
7. Test with `--vault` override

## Flow Plugin Changes

Add new setting to Flow plugin:

**Settings UI:**

```
CLI Inbox File
Path to file for CLI quick captures (relative to vault root)
[Flow CLI Inbox.md]
```

**Default value:** `Flow CLI Inbox.md`

**Setting key:** `cliInboxFile` in plugin settings interface

This setting lives in the plugin, not the CLI. The CLI reads it but doesn't write it.

## Publishing

1. Publish to npm as `@flow/cli` (or `flow-cli` if org unavailable)
2. Document installation in Flow plugin README
3. Add troubleshooting guide for common errors

## Future Enhancements (Not in Scope)

- Multiple inbox files with categories
- Read from stdin for piping
- List/clear inbox commands
- Shell completion
- Desktop notifications on capture

Keep the initial version simple - just capture text to a file.
