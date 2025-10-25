# Beta Release Workflow Design

**Date:** 2025-10-25
**Status:** Approved

## Overview

This design documents a fully automated beta release workflow for distributing private beta versions of the Flow plugin via BRAT (Beta Reviewer's Auto-update Tool). The workflow enables rapid iteration with beta testers without interfering with the existing production release process.

## Goals

- Single command to create and publish beta releases
- Semantic versioning with pre-release format (e.g., `0.7.1-beta.1`)
- Automatic version detection and increment for iterative beta releases
- Interactive version selection for new beta cycles
- Full automation with confirmation before execution
- No impact on existing production release workflow

## Context

### BRAT Requirements

BRAT (Beta Reviewer's Auto-update Tool) allows Obsidian users to install and auto-update plugins from GitHub releases. For a plugin to work with BRAT:

1. **GitHub Releases:** BRAT examines repository releases and uses the release tag as the source of truth
2. **Required Assets:** Each release must include:
   - `manifest.json` - Plugin metadata with version number
   - `main.js` - Compiled plugin code
   - `styles.css` - Plugin styles (if applicable)
3. **Version Matching:** Release tag, release name, and manifest.json version should all match
4. **Pre-releases:** GitHub releases can be marked as pre-releases for beta versions
5. **Private Repositories:** Beta testers configure a Personal Access Token (PAT) in BRAT settings to access private repos

### Existing Release Infrastructure

- **Production versioning:** `npm version` workflow updates package.json, then `version-bump.mjs` syncs to manifest.json and versions.json
- **Current version:** 0.7.0 (production)
- **Build system:** `npm run build` compiles TypeScript and bundles with esbuild
- **Repository:** Private repo at `github.com/tavva/flow`

## Architecture

### Approach: Node.js Script

A standalone Node.js script (`scripts/release-beta.mjs`) handles the entire beta release workflow. This approach:

- Provides robust JSON parsing (consistent with existing `version-bump.mjs`)
- Requires no external dependencies beyond `gh` CLI
- Keeps beta workflow separate from production workflow
- Uses standard Node.js built-ins (`fs`, `child_process`, `readline`)

### Workflow Steps

1. **Read current version** from `manifest.json`
2. **Detect version type** - beta or production
3. **Calculate next version:**
   - If already beta: auto-increment beta number (`0.7.1-beta.2` → `0.7.1-beta.3`)
   - If production: prompt user for patch/minor/custom
4. **Update manifest.json** with new version
5. **Build plugin** via `npm run build`
6. **Display planned actions** (gh release command + git commands)
7. **Ask for confirmation**
8. **Execute on confirmation:**
   - Create GitHub release with `gh release create`
   - Commit manifest.json change
   - Push to remote

## Detailed Design

### Version Parsing and Calculation

**Version Detection:**
- Regex pattern: `/^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/`
- Captures: `[major, minor, patch, betaNumber]`
- Examples:
  - `0.7.0` → `[0, 7, 0, undefined]` (production)
  - `0.7.1-beta.2` → `[0, 7, 1, 2]` (beta)

**Auto-increment Logic (Already Beta):**
```
Current: 0.7.1-beta.2
Next:    0.7.1-beta.3
```
No user prompt required - automatically increment beta number.

**Interactive Selection (Production Version):**
```
Current version: 0.7.0

Select version bump:
1) Patch: 0.7.1-beta.1
2) Minor: 0.8.0-beta.1
3) Custom (enter version manually)

Choice (1/2/3):
```

**Custom Version Validation:**
- Must match semver beta format: `X.Y.Z-beta.N`
- Validate with regex before accepting

### Confirmation Flow

Before executing any commands, display full plan:

```
✓ Built plugin successfully
✓ manifest.json updated to 0.7.1-beta.1

The following commands will be executed:
  gh release create 0.7.1-beta.1 \
    --title "Beta v0.7.1-beta.1" \
    --prerelease \
    manifest.json main.js styles.css

  git add manifest.json
  git commit -m "Release beta v0.7.1-beta.1"
  git push

Proceed with release? (y/n)
```

On `y`: Execute all commands in sequence.
On `n`: Abort without executing.

### Error Handling and Safety Checks

**Pre-flight Checks:**

1. **Verify required files exist:**
   - `manifest.json` exists and is valid JSON
   - After build: `main.js` exists
   - `styles.css` exists (or handle gracefully if missing)

2. **Verify clean git state:**
   - Check `git status --porcelain`
   - If dirty: warn user and ask to stash/commit or abort

3. **Verify `gh` CLI available:**
   - Run `gh --version` to check installation
   - Exit with helpful error if not found

4. **Verify `gh` authentication:**
   - Run `gh auth status`
   - Exit with instructions if not authenticated

**Error Handling During Execution:**

- Wrap all `execSync` calls in try-catch blocks
- **Build failure:** Stop immediately, show build errors
- **Release creation failure:** Stop before git operations, show error
- **Git operation failure:** Warn about uncommitted manifest.json

**Rollback Strategy:**

- No automatic rollback (manual control preferred)
- If release fails after manifest.json update: print rollback command
  - `git checkout manifest.json`
- If git push fails: release exists but commit is local-only

### File Structure

**New Files:**
```
scripts/
  release-beta.mjs    # Main beta release script
```

**Modified Files:**
```
package.json          # Add "release:beta" npm script
```

**Unchanged Files:**
```
package.json          # version field stays at production version
versions.json         # only updated for production releases
version-bump.mjs      # production release workflow unchanged
```

### Integration

**NPM Script:**
```json
{
  "scripts": {
    "release:beta": "node scripts/release-beta.mjs"
  }
}
```

**Usage:**
```bash
npm run release:beta
```

**GitHub Release Details:**
- Tag: Version number (e.g., `0.7.1-beta.1`)
- Title: `Beta v{version}` (e.g., `Beta v0.7.1-beta.1`)
- Pre-release: Yes (marked with `--prerelease` flag)
- Assets: `manifest.json`, `main.js`, `styles.css`

### BRAT Setup for Beta Testers

1. **Provide PAT:** Share GitHub Personal Access Token with testers
2. **Add token to BRAT:** Testers configure in BRAT settings
3. **Add beta plugin:** Use BRAT command "Add a beta plugin for testing"
4. **Repository path:** `tavva/flow`
5. **Auto-updates:** BRAT will detect new releases and prompt to update

## Implementation Notes

- **Separation of concerns:** Beta releases don't modify package.json or versions.json (production-only)
- **Idempotent:** Safe to re-run if release fails partway through
- **Manual push review:** User can inspect git state before changes are pushed
- **Standard tools:** Uses only Node.js built-ins + `gh` CLI (widely available)

## Non-Goals

- Automated production releases (existing workflow remains unchanged)
- Automatic changelog generation (manual for now)
- CI/CD integration (local command only)
- Notification system for beta testers (BRAT handles updates)

## Success Criteria

- Single command creates complete beta release
- Version numbers follow semantic versioning
- GitHub releases properly marked as pre-releases
- BRAT can detect and install beta versions
- No interference with production release workflow
- Clear error messages for common failure modes
