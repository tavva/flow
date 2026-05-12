// ABOUTME: Beta release script for creating and publishing versioned beta releases.
// ABOUTME: Handles version parsing, calculation, and GitHub release creation via BRAT.

import * as readline from "readline";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { execSync, execFileSync } from "child_process";
import { tmpdir } from "os";

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  betaNumber: number | undefined;
  isBeta: boolean;
}

/**
 * Parses a semantic version string into components
 * @param version - Version string (e.g., "0.7.0" or "0.7.1-beta.2")
 * @returns Parsed version or null if invalid
 */
export function parseVersion(version: string): ParsedVersion | null {
  const pattern = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/;
  const match = version.match(pattern);

  if (!match) return null;

  const [, major, minor, patch, betaNumber] = match;

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    betaNumber: betaNumber ? parseInt(betaNumber, 10) : undefined,
    isBeta: betaNumber !== undefined,
  };
}

/**
 * Calculates the next version based on current version and bump type
 * @param current - Parsed current version
 * @param bumpType - 'auto' for beta increment, 'patch', 'minor', or custom version
 * @returns Next version string
 */
export function calculateNextVersion(current: ParsedVersion | null, bumpType: string): string {
  if (!current) {
    // Validate custom version when current is null
    const parsed = parseVersion(bumpType);
    if (!parsed) {
      throw new Error("Invalid custom version");
    }
    return bumpType;
  }

  if (bumpType === "auto") {
    // Validate that we're auto-incrementing a beta version
    if (!current.isBeta) {
      throw new Error("Cannot auto-increment beta number on production version");
    }
    // Auto-increment beta number (using non-null assertion since we know it exists)
    return `${current.major}.${current.minor}.${current.patch}-beta.${current.betaNumber! + 1}`;
  }

  if (bumpType === "patch") {
    return `${current.major}.${current.minor}.${current.patch + 1}-beta.1`;
  }

  if (bumpType === "minor") {
    return `${current.major}.${current.minor + 1}.0-beta.1`;
  }

  // Custom version - validate and return
  const parsed = parseVersion(bumpType);
  if (!parsed) {
    throw new Error("Invalid custom version");
  }
  return bumpType;
}

/**
 * Prompts user to select version bump type
 * @param current - Parsed current version
 * @returns Promise resolving to 'patch', 'minor', or a custom version string
 */
export function promptVersionBump(current: ParsedVersion): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Calculate what each option would result in
    const patchVersion = `${current.major}.${current.minor}.${current.patch + 1}-beta.1`;
    const minorVersion = `${current.major}.${current.minor + 1}.0-beta.1`;

    console.log(`\nCurrent version: ${current.major}.${current.minor}.${current.patch}\n`);
    console.log("Select version bump:");
    console.log(`1) Patch: ${patchVersion}`);
    console.log(`2) Minor: ${minorVersion}`);
    console.log("3) Custom (enter version manually)\n");

    rl.question("Choice (1/2/3): ", (answer) => {
      const choice = answer.trim();

      if (choice === "1") {
        rl.close();
        resolve("patch");
      } else if (choice === "2") {
        rl.close();
        resolve("minor");
      } else if (choice === "3") {
        rl.question("Enter custom version (format: X.Y.Z-beta.N): ", (customVersion) => {
          const trimmed = customVersion.trim();
          const parsed = parseVersion(trimmed);

          if (!parsed || !parsed.isBeta) {
            rl.close();
            reject(new Error("Invalid version format. Must be X.Y.Z-beta.N"));
            return;
          }

          rl.close();
          resolve(trimmed);
        });
      } else {
        rl.close();
        reject(new Error("Invalid choice. Please enter 1, 2, or 3"));
      }
    });
  });
}

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  description: string;
  author: string;
  authorUrl: string;
  isDesktopOnly: boolean;
}

/**
 * Reads and parses the manifest.json file
 * @returns Parsed manifest object
 */
export function readManifest(): PluginManifest {
  const manifestPath = join(process.cwd(), "manifest.json");

  if (!existsSync(manifestPath)) {
    throw new Error("manifest.json not found in current directory");
  }

  const content = readFileSync(manifestPath, "utf-8");
  return JSON.parse(content) as PluginManifest;
}

/**
 * Updates manifest.json with new version
 * @param version - New version string to set
 */
export function updateManifest(version: string): void {
  const manifestPath = join(process.cwd(), "manifest.json");
  const manifest = readManifest();

  manifest.version = version;

  // Write with tabs for indentation to match existing format
  writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n", "utf-8");
}

interface PackageJson {
  name: string;
  version: string;
  [key: string]: unknown;
}

/**
 * Reads and parses the package.json file
 * @returns Parsed package.json object
 */
export function readPackageJson(): PackageJson {
  const packagePath = join(process.cwd(), "package.json");

  if (!existsSync(packagePath)) {
    throw new Error("package.json not found in current directory");
  }

  const content = readFileSync(packagePath, "utf-8");
  return JSON.parse(content) as PackageJson;
}

/**
 * Updates package.json with new version
 * @param version - New version string to set
 */
export function updatePackageJson(version: string): void {
  const packagePath = join(process.cwd(), "package.json");
  const pkg = readPackageJson();

  pkg.version = version;

  // Write with 2-space indentation to match existing format
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
}

/**
 * Verifies that all required build files exist
 * @throws Error if any required files are missing
 */
export function verifyBuildFiles(): void {
  const requiredFiles = ["main.js", "manifest.json"];
  const optionalFiles = ["styles.css"];
  const missingFiles: string[] = [];

  for (const file of requiredFiles) {
    const filePath = join(process.cwd(), file);
    if (!existsSync(filePath)) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(`Missing required build files: ${missingFiles.join(", ")}`);
  }

  // Check optional files
  for (const file of optionalFiles) {
    const filePath = join(process.cwd(), file);
    if (!existsSync(filePath)) {
      console.log(`Note: ${file} not found (plugin may not have styles)`);
    }
  }
}

/**
 * Gets the version from the main branch's manifest.json
 * @returns Parsed version from main branch, or null if unable to read
 */
export function getMainBranchVersion(): ParsedVersion | null {
  try {
    const output = execSync("git show main:manifest.json", { encoding: "utf-8", stdio: "pipe" });
    const manifest = JSON.parse(output) as PluginManifest;
    return parseVersion(manifest.version);
  } catch {
    return null;
  }
}

/**
 * Compares base versions (ignoring beta suffix)
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareBaseVersions(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Checks if git working directory is clean
 * @returns true if clean, false otherwise
 */
export function checkGitStatus(): boolean {
  try {
    const output = execSync("git status --porcelain", { encoding: "utf-8" });
    if (output.trim() !== "") {
      console.error("Error: Git working directory is not clean");
      console.error("Please commit or stash your changes before releasing");
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error: Failed to check git status");
    console.error(error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Verifies gh CLI is installed and authenticated
 * @returns true if available and authenticated, false otherwise
 */
export function checkGitHubCLI(): boolean {
  // Check if gh is installed
  try {
    execSync("gh --version", { encoding: "utf-8", stdio: "pipe" });
  } catch (error) {
    console.error("Error: GitHub CLI (gh) is not installed");
    console.error("Install from: https://cli.github.com/");
    return false;
  }

  // Check if gh is authenticated
  try {
    execSync("gh auth status", { encoding: "utf-8", stdio: "pipe" });
    return true;
  } catch (error) {
    console.error("Error: GitHub CLI is not authenticated");
    console.error("Run: gh auth login");
    return false;
  }
}

/**
 * Checks code formatting using Prettier
 * @returns true if code is formatted correctly, false otherwise
 */
export function checkFormatting(): boolean {
  console.log("Checking code formatting...");

  try {
    execSync("npm run format:check", {
      stdio: "pipe",
      encoding: "utf-8",
    });
    console.log("✓ Code formatting is correct\n");
    return true;
  } catch (error) {
    console.error("✗ Code formatting check failed");
    console.error("Run: npm run format\n");
    return false;
  }
}

/**
 * Runs test suite
 * @returns true if all tests pass, false otherwise
 */
export function checkTests(): boolean {
  console.log("Running tests...");

  try {
    execSync("npm test", {
      stdio: "inherit",
      encoding: "utf-8",
    });
    console.log("✓ All tests passed\n");
    return true;
  } catch (error) {
    console.error("✗ Tests failed\n");
    return false;
  }
}

/**
 * Runs all pre-flight checks before releasing
 * @returns true if all checks pass, false otherwise
 */
export function runPreflightChecks(): boolean {
  if (!checkGitStatus()) {
    return false;
  }

  if (!checkGitHubCLI()) {
    return false;
  }

  if (!checkFormatting()) {
    return false;
  }

  if (!checkTests()) {
    return false;
  }

  return true;
}

/**
 * Builds the plugin using npm build
 * @returns true if build succeeds, false otherwise
 */
export function buildPlugin(): boolean {
  console.log("\nBuilding plugin...");

  try {
    execSync("npm run build", {
      stdio: "inherit",
      encoding: "utf-8",
    });

    console.log("✓ Build completed successfully\n");
    return true;
  } catch (error) {
    console.error("✗ Build failed\n");
    return false;
  }
}

/**
 * Determines which release assets to include based on file presence
 * @returns Array of asset file names
 */
export function getReleaseAssets(): string[] {
  const hasStyles = existsSync(join(process.cwd(), "styles.css"));
  return hasStyles ? ["manifest.json", "main.js", "styles.css"] : ["manifest.json", "main.js"];
}

/**
 * Displays planned commands and asks for confirmation
 * @param version - Version to release
 * @returns Promise resolving to true if user confirms
 */
export function confirmRelease(version: string): Promise<boolean> {
  return new Promise((resolve) => {
    const assets = getReleaseAssets().join(" ");

    console.log("The following commands will be executed:\n");
    console.log(`  gh release create ${version} \\`);
    console.log("    --repo tavva/flow \\");
    console.log(`    --title "Beta v${version}" \\`);
    console.log("    --prerelease \\");
    console.log(`    ${assets}\n`);
    console.log("  git add manifest.json package.json");
    console.log(`  git commit -m "Release beta v${version}"`);
    console.log("  git push\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Proceed with release? (y/n): ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

/**
 * Creates GitHub release in tavva/flow
 * @param version - Version to release
 * @returns true if successful, false otherwise
 */
export function createGitHubRelease(version: string): boolean {
  const assets = getReleaseAssets();
  const releaseNotes = `Beta release v${version}`;
  const notesFile = join(tmpdir(), `flow-beta-release-notes-${version}-${Date.now()}.md`);

  console.log("\nCreating GitHub release...\n");

  try {
    writeFileSync(notesFile, releaseNotes, "utf-8");
    execFileSync(
      "gh",
      [
        "release",
        "create",
        version,
        "--repo",
        "tavva/flow",
        "--title",
        `Beta v${version}`,
        "--notes-file",
        notesFile,
        "--prerelease",
        ...assets,
      ],
      { stdio: "inherit" }
    );
    unlinkSync(notesFile);
    console.log("✓ Release created in tavva/flow\n");
    return true;
  } catch (error) {
    try {
      unlinkSync(notesFile);
    } catch {
      // Ignore cleanup errors
    }
    console.error("\nError creating release. Manifest was updated but release failed.");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("To rollback: git checkout manifest.json\n");
    return false;
  }
}

/**
 * Commits and pushes changes
 * @param version - Version being released
 * @returns true if successful, false otherwise
 */
export function commitAndPush(version: string): boolean {
  console.log("Committing and pushing changes...\n");

  try {
    execFileSync("git", ["add", "manifest.json", "package.json"], { stdio: "inherit" });
    execFileSync("git", ["commit", "-m", `Release beta v${version}`], { stdio: "inherit" });
    execFileSync("git", ["push"], { stdio: "inherit" });
    console.log("\n✓ Changes committed and pushed\n");
    return true;
  } catch (error) {
    console.error("\nError during git operations");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Release was created but changes not pushed");
    console.error("You may need to manually commit and push manifest.json and package.json\n");
    return false;
  }
}

/**
 * Reverts manifest.json and package.json to their state in git
 */
function rollbackVersionFiles(): void {
  execFileSync("git", ["checkout", "manifest.json", "package.json"]);
}

/**
 * Main entry point that orchestrates the entire release workflow
 */
async function main(): Promise<void> {
  console.log("\n=== Beta Release Workflow ===\n");

  // Pre-flight checks
  if (!runPreflightChecks()) {
    process.exit(1);
  }

  // Read current version
  const manifest = readManifest();
  const current = parseVersion(manifest.version);

  if (!current) {
    console.error("Error: Invalid version in manifest.json");
    process.exit(1);
  }

  // Check main branch version to detect if it has caught up
  const mainVersion = getMainBranchVersion();
  const mainHasCaughtUp = mainVersion && compareBaseVersions(mainVersion, current) >= 0;

  // Determine next version
  let nextVersion: string;
  if (current.isBeta && !mainHasCaughtUp) {
    // Auto-increment beta (main hasn't caught up yet)
    nextVersion = calculateNextVersion(current, "auto");
    console.log(`Auto-incrementing beta: ${manifest.version} → ${nextVersion}\n`);
  } else {
    // Interactive selection (either non-beta or main has caught up)
    if (mainHasCaughtUp && mainVersion) {
      console.log(
        `Main branch is at ${mainVersion.major}.${mainVersion.minor}.${mainVersion.patch}`
      );
      console.log(
        `Current beta base ${current.major}.${current.minor}.${current.patch} needs bumping.\n`
      );
    }
    const bumpType = await promptVersionBump(
      mainVersion && mainHasCaughtUp ? mainVersion : current
    );
    nextVersion = calculateNextVersion(
      mainVersion && mainHasCaughtUp ? mainVersion : current,
      bumpType
    );
  }

  // Update version files
  updateManifest(nextVersion);
  updatePackageJson(nextVersion);

  // Build plugin
  if (!buildPlugin()) {
    console.error("Reverting version changes...");
    rollbackVersionFiles();
    process.exit(1);
  }

  // Verify build files
  try {
    verifyBuildFiles();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Reverting version changes...");
    rollbackVersionFiles();
    process.exit(1);
  }

  // Confirm and execute
  const confirmed = await confirmRelease(nextVersion);
  if (!confirmed) {
    console.log("Release cancelled. Reverting version changes...");
    rollbackVersionFiles();
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

// Run if called directly (TypeScript/Node.js entry point check)
if (require.main === module) {
  main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}
