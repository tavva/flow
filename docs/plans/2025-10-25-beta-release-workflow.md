# Beta Release Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a fully automated beta release workflow for distributing private beta versions via BRAT with a single npm command.

**Architecture:** Node.js script (`scripts/release-beta.mjs`) that parses current version from manifest.json, calculates next beta version (auto-increment if already beta, interactive selection if production), builds plugin, displays planned actions, confirms with user, then executes GitHub release creation and git operations.

**Tech Stack:** Node.js built-ins (fs, child_process, readline), GitHub CLI (gh)

---

## Task 1: Create Scripts Directory and Version Parsing Logic

**Files:**
- Create: `scripts/release-beta.mjs`
- Test: `tests/release-beta.test.ts`

**Step 1: Write the failing test for version parsing**

Create test file:

```typescript
// tests/release-beta.test.ts
import { parseVersion, calculateNextVersion } from '../scripts/release-beta.mjs';

describe('Version Parsing', () => {
  test('should parse production version', () => {
    const result = parseVersion('0.7.0');
    expect(result).toEqual({
      major: 0,
      minor: 7,
      patch: 0,
      betaNumber: undefined,
      isBeta: false
    });
  });

  test('should parse beta version', () => {
    const result = parseVersion('0.7.1-beta.2');
    expect(result).toEqual({
      major: 0,
      minor: 7,
      patch: 1,
      betaNumber: 2,
      isBeta: true
    });
  });

  test('should return null for invalid version', () => {
    const result = parseVersion('invalid');
    expect(result).toBeNull();
  });
});

describe('Next Version Calculation', () => {
  test('should auto-increment beta number', () => {
    const current = parseVersion('0.7.1-beta.2');
    const next = calculateNextVersion(current, 'auto');
    expect(next).toBe('0.7.1-beta.3');
  });

  test('should create patch beta from production', () => {
    const current = parseVersion('0.7.0');
    const next = calculateNextVersion(current, 'patch');
    expect(next).toBe('0.7.1-beta.1');
  });

  test('should create minor beta from production', () => {
    const current = parseVersion('0.7.0');
    const next = calculateNextVersion(current, 'minor');
    expect(next).toBe('0.8.0-beta.1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- release-beta.test`
Expected: FAIL with "Cannot find module '../scripts/release-beta.mjs'"

**Step 3: Create scripts directory**

Run: `mkdir -p scripts`

**Step 4: Write minimal implementation for version parsing**

```javascript
// scripts/release-beta.mjs
#!/usr/bin/env node

/**
 * Parses a semantic version string into components
 * @param {string} version - Version string (e.g., "0.7.0" or "0.7.1-beta.2")
 * @returns {Object|null} Parsed version or null if invalid
 */
export function parseVersion(version) {
  const pattern = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/;
  const match = version.match(pattern);

  if (!match) return null;

  const [, major, minor, patch, betaNumber] = match;

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    betaNumber: betaNumber ? parseInt(betaNumber, 10) : undefined,
    isBeta: betaNumber !== undefined
  };
}

/**
 * Calculates the next version based on current version and bump type
 * @param {Object} current - Parsed current version
 * @param {string} bumpType - 'auto' for beta increment, 'patch', 'minor', or custom version
 * @returns {string} Next version string
 */
export function calculateNextVersion(current, bumpType) {
  if (bumpType === 'auto') {
    // Auto-increment beta number
    return `${current.major}.${current.minor}.${current.patch}-beta.${current.betaNumber + 1}`;
  }

  if (bumpType === 'patch') {
    return `${current.major}.${current.minor}.${current.patch + 1}-beta.1`;
  }

  if (bumpType === 'minor') {
    return `${current.major}.${current.minor + 1}.0-beta.1`;
  }

  // Custom version - validate and return
  return bumpType;
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- release-beta.test`
Expected: PASS (all 6 tests)

**Step 6: Commit**

```bash
git add scripts/release-beta.mjs tests/release-beta.test.ts
git commit -m "feat: add version parsing logic for beta releases"
```

---

## Task 2: Add Interactive Version Selection

**Files:**
- Modify: `scripts/release-beta.mjs`
- Test: Manual testing (readline is interactive, hard to unit test)

**Step 1: Add readline prompt function**

Add to `scripts/release-beta.mjs`:

```javascript
import * as readline from 'readline';

/**
 * Prompts user for version bump type
 * @param {Object} current - Parsed current version
 * @returns {Promise<string>} Selected bump type or custom version
 */
export async function promptVersionBump(current) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => {
    rl.question(query, resolve);
  });

  const currentVersion = `${current.major}.${current.minor}.${current.patch}`;
  const patchVersion = calculateNextVersion(current, 'patch');
  const minorVersion = calculateNextVersion(current, 'minor');

  console.log(`\nCurrent version: ${currentVersion}\n`);
  console.log('Select version bump:');
  console.log(`1) Patch: ${patchVersion}`);
  console.log(`2) Minor: ${minorVersion}`);
  console.log('3) Custom (enter version manually)\n');

  const choice = await question('Choice (1/2/3): ');

  if (choice === '1') {
    rl.close();
    return 'patch';
  }

  if (choice === '2') {
    rl.close();
    return 'minor';
  }

  if (choice === '3') {
    const custom = await question('Enter version (e.g., 0.8.0-beta.1): ');
    rl.close();

    // Validate custom version
    if (!parseVersion(custom)) {
      console.error('Invalid version format. Must match X.Y.Z-beta.N');
      process.exit(1);
    }

    return custom;
  }

  console.error('Invalid choice');
  rl.close();
  process.exit(1);
}
```

**Step 2: Commit**

```bash
git add scripts/release-beta.mjs
git commit -m "feat: add interactive version selection prompt"
```

---

## Task 3: Add Build and File Management

**Files:**
- Modify: `scripts/release-beta.mjs`

**Step 1: Add file reading and manifest update functions**

Add to `scripts/release-beta.mjs`:

```javascript
import { readFileSync, writeFileSync, existsSync } from 'fs';

/**
 * Reads and parses manifest.json
 * @returns {Object} Parsed manifest
 */
export function readManifest() {
  if (!existsSync('manifest.json')) {
    console.error('Error: manifest.json not found');
    process.exit(1);
  }

  try {
    return JSON.parse(readFileSync('manifest.json', 'utf8'));
  } catch (error) {
    console.error('Error parsing manifest.json:', error.message);
    process.exit(1);
  }
}

/**
 * Updates manifest.json with new version
 * @param {string} version - New version string
 */
export function updateManifest(version) {
  const manifest = readManifest();
  manifest.version = version;
  writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t'));
  console.log(`✓ manifest.json updated to ${version}`);
}

/**
 * Verifies required build files exist
 * @returns {boolean} True if all files exist
 */
export function verifyBuildFiles() {
  const required = ['manifest.json', 'main.js'];
  const optional = ['styles.css'];

  for (const file of required) {
    if (!existsSync(file)) {
      console.error(`Error: Required file ${file} not found`);
      return false;
    }
  }

  // styles.css is optional - just note if missing
  if (!existsSync('styles.css')) {
    console.log('Note: styles.css not found (plugin may not have styles)');
  }

  return true;
}
```

**Step 2: Commit**

```bash
git add scripts/release-beta.mjs
git commit -m "feat: add manifest reading/updating and build file verification"
```

---

## Task 4: Add Pre-flight Checks

**Files:**
- Modify: `scripts/release-beta.mjs`

**Step 1: Add pre-flight check functions**

Add to `scripts/release-beta.mjs`:

```javascript
import { execSync } from 'child_process';

/**
 * Checks if git working directory is clean
 * @returns {boolean} True if clean
 */
export function checkGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
      console.error('\nError: Working directory has uncommitted changes');
      console.error('Please commit or stash changes before releasing\n');
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error checking git status:', error.message);
    return false;
  }
}

/**
 * Verifies GitHub CLI is installed and authenticated
 * @returns {boolean} True if ready
 */
export function checkGitHubCLI() {
  try {
    execSync('gh --version', { stdio: 'pipe' });
  } catch (error) {
    console.error('\nError: GitHub CLI (gh) not found');
    console.error('Install from: https://cli.github.com\n');
    return false;
  }

  try {
    execSync('gh auth status', { stdio: 'pipe' });
  } catch (error) {
    console.error('\nError: GitHub CLI not authenticated');
    console.error('Run: gh auth login\n');
    return false;
  }

  return true;
}

/**
 * Runs all pre-flight checks
 * @returns {boolean} True if all checks pass
 */
export function runPreflightChecks() {
  console.log('Running pre-flight checks...\n');

  if (!checkGitStatus()) return false;
  if (!checkGitHubCLI()) return false;

  console.log('✓ All pre-flight checks passed\n');
  return true;
}
```

**Step 2: Commit**

```bash
git add scripts/release-beta.mjs
git commit -m "feat: add pre-flight checks for git and GitHub CLI"
```

---

## Task 5: Add Build Execution

**Files:**
- Modify: `scripts/release-beta.mjs`

**Step 1: Add build function**

Add to `scripts/release-beta.mjs`:

```javascript
/**
 * Runs npm build
 * @returns {boolean} True if build succeeds
 */
export function buildPlugin() {
  console.log('Building plugin...\n');

  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('\n✓ Build completed successfully\n');
    return true;
  } catch (error) {
    console.error('\nBuild failed. Please fix errors before releasing.\n');
    return false;
  }
}
```

**Step 2: Commit**

```bash
git add scripts/release-beta.mjs
git commit -m "feat: add plugin build execution"
```

---

## Task 6: Add Confirmation and Release Execution

**Files:**
- Modify: `scripts/release-beta.mjs`

**Step 1: Add confirmation and execution functions**

Add to `scripts/release-beta.mjs`:

```javascript
/**
 * Displays planned commands and asks for confirmation
 * @param {string} version - Version to release
 * @returns {Promise<boolean>} True if user confirms
 */
export async function confirmRelease(version) {
  const hasStyles = existsSync('styles.css');
  const assets = hasStyles
    ? 'manifest.json main.js styles.css'
    : 'manifest.json main.js';

  console.log('The following commands will be executed:\n');
  console.log(`  gh release create ${version} \\`);
  console.log(`    --title "Beta v${version}" \\`);
  console.log('    --prerelease \\');
  console.log(`    ${assets}\n`);
  console.log('  git add manifest.json');
  console.log(`  git commit -m "Release beta v${version}"`);
  console.log('  git push\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise((resolve) => {
    rl.question('Proceed with release? (y/n): ', resolve);
  });

  rl.close();

  return answer.toLowerCase() === 'y';
}

/**
 * Creates GitHub release
 * @param {string} version - Version to release
 * @returns {boolean} True if successful
 */
export function createGitHubRelease(version) {
  const hasStyles = existsSync('styles.css');
  const assets = hasStyles
    ? 'manifest.json main.js styles.css'
    : 'manifest.json main.js';

  console.log('\nCreating GitHub release...\n');

  try {
    execSync(
      `gh release create ${version} --title "Beta v${version}" --prerelease ${assets}`,
      { stdio: 'inherit' }
    );
    console.log('\n✓ GitHub release created\n');
    return true;
  } catch (error) {
    console.error('\nError creating release. Manifest was updated but release failed.');
    console.error('To rollback: git checkout manifest.json\n');
    return false;
  }
}

/**
 * Commits and pushes changes
 * @param {string} version - Version being released
 * @returns {boolean} True if successful
 */
export function commitAndPush(version) {
  console.log('Committing and pushing changes...\n');

  try {
    execSync('git add manifest.json', { stdio: 'inherit' });
    execSync(`git commit -m "Release beta v${version}"`, { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    console.log('\n✓ Changes committed and pushed\n');
    return true;
  } catch (error) {
    console.error('\nError during git operations');
    console.error('Release was created but changes not pushed');
    console.error('You may need to manually commit and push manifest.json\n');
    return false;
  }
}
```

**Step 2: Commit**

```bash
git add scripts/release-beta.mjs
git commit -m "feat: add release confirmation and execution functions"
```

---

## Task 7: Add Main Entry Point

**Files:**
- Modify: `scripts/release-beta.mjs`

**Step 1: Add main function**

Add to `scripts/release-beta.mjs`:

```javascript
/**
 * Main entry point
 */
async function main() {
  console.log('\n=== Beta Release Workflow ===\n');

  // Pre-flight checks
  if (!runPreflightChecks()) {
    process.exit(1);
  }

  // Read current version
  const manifest = readManifest();
  const current = parseVersion(manifest.version);

  if (!current) {
    console.error('Error: Invalid version in manifest.json');
    process.exit(1);
  }

  // Determine next version
  let nextVersion;
  if (current.isBeta) {
    // Auto-increment beta
    nextVersion = calculateNextVersion(current, 'auto');
    console.log(`Auto-incrementing beta: ${manifest.version} → ${nextVersion}\n`);
  } else {
    // Interactive selection
    const bumpType = await promptVersionBump(current);
    nextVersion = calculateNextVersion(current, bumpType);
  }

  // Update manifest
  updateManifest(nextVersion);

  // Build plugin
  if (!buildPlugin()) {
    console.error('Reverting manifest changes...');
    execSync('git checkout manifest.json');
    process.exit(1);
  }

  // Verify build files
  if (!verifyBuildFiles()) {
    console.error('Reverting manifest changes...');
    execSync('git checkout manifest.json');
    process.exit(1);
  }

  // Confirm and execute
  const confirmed = await confirmRelease(nextVersion);
  if (!confirmed) {
    console.log('Release cancelled. Reverting manifest changes...');
    execSync('git checkout manifest.json');
    process.exit(0);
  }

  // Create release
  if (!createGitHubRelease(nextVersion)) {
    process.exit(1);
  }

  // Commit and push
  if (!commitAndPush(nextVersion)) {
    process.exit(1);
  }

  console.log(`\n✓ Beta v${nextVersion} released successfully!\n`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}
```

**Step 2: Make script executable**

Run: `chmod +x scripts/release-beta.mjs`

**Step 3: Commit**

```bash
git add scripts/release-beta.mjs
git commit -m "feat: add main entry point for beta release script"
```

---

## Task 8: Add NPM Script and Documentation

**Files:**
- Modify: `package.json`
- Create: `docs/beta-release.md` (optional documentation)

**Step 1: Add npm script to package.json**

Modify the `scripts` section in `package.json`:

```json
{
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "lint": "tsc -noEmit -skipLibCheck",
    "format": "prettier --write \"**/*.{ts,js,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,js,json,md}\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "evaluate": "ts-node -P evaluation/tsconfig.json evaluation/run-evaluation.ts",
    "version": "node version-bump.mjs && git add manifest.json versions.json",
    "cli": "node dist/cli.mjs",
    "build:cli": "node esbuild.cli.mjs",
    "release:beta": "node scripts/release-beta.mjs"
  }
}
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "feat: add release:beta npm script"
```

---

## Task 9: Manual Testing and Verification

**Files:**
- None (manual testing only)

**Step 1: Test with current production version**

Before running, verify current state:
- Run: `cat manifest.json | grep version`
- Expected: Shows current production version (e.g., `"version": "0.7.0"`)

**Step 2: Do a dry run test**

Since this will actually create a release, we should test the pre-flight checks and version selection first:

Run: `npm run release:beta`

Expected workflow:
1. Pre-flight checks pass (clean git, gh installed)
2. Shows current version
3. Prompts for version selection (test each option)
4. Updates manifest.json
5. Runs build
6. Shows confirmation prompt
7. **Type 'n' to cancel** (don't create actual release yet)
8. Manifest reverts

**Step 3: Review the code**

Before creating an actual release, review:
- All error handling paths
- Rollback mechanisms work correctly
- Console output is clear and helpful

**Step 4: Document for Ben**

Add note to implementation plan about testing strategy:
- Can test by selecting 'n' at confirmation
- First real release will be from current version (0.7.0)
- Subsequent beta releases will auto-increment

**Step 5: Commit**

```bash
git add docs/plans/2025-10-25-beta-release-workflow.md
git commit -m "docs: add testing notes to implementation plan"
```

---

## Task 10: Final Integration Test (Optional)

**Note:** Only run this if Ben wants to create an actual beta release immediately.

**Step 1: Create first beta release**

Run: `npm run release:beta`

Select: Option 1 (Patch) to create `0.7.1-beta.1`

Confirm: Type 'y' at confirmation prompt

**Step 2: Verify release on GitHub**

1. Visit: `https://github.com/tavva/flow/releases`
2. Verify: Release `0.7.1-beta.1` exists
3. Verify: Marked as "Pre-release"
4. Verify: Has assets: `manifest.json`, `main.js`, `styles.css`

**Step 3: Test BRAT installation (if testers available)**

1. Provide PAT to tester
2. Tester adds token in BRAT settings
3. Tester adds plugin via "Add a beta plugin for testing"
4. Repository: `tavva/flow`
5. Verify: Plugin installs successfully

**Step 4: Test beta increment**

Run: `npm run release:beta` again

Expected: Auto-increments to `0.7.1-beta.2` without prompting

---

## Post-Implementation

After all tasks complete:

1. **Update CLAUDE.md** (optional): Add section about beta release workflow
2. **Create README** (optional): Document the release process for future reference
3. **Test with testers**: Provide PAT and get feedback on BRAT installation

---

## Key Testing Considerations

- **Unit tests** cover version parsing and calculation logic
- **Manual testing** required for interactive prompts and external commands
- **Integration test** creates actual GitHub release (use cautiously)
- Test rollback by cancelling at confirmation prompt
- Verify error handling by testing with dirty git state, missing gh CLI, etc.

---

## DRY, YAGNI, TDD Compliance

- **DRY**: Functions are single-purpose and reusable
- **YAGNI**: No unnecessary features (changelog generation, CI/CD, etc.)
- **TDD**: Core logic (version parsing/calculation) has tests; interactive parts tested manually
- **Frequent commits**: Each task results in a commit with logical change
