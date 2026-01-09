// ABOUTME: Production release script for creating and publishing versioned releases.
// ABOUTME: Handles version bumping, release notes, file updates, and GitHub release creation.

import * as readline from "readline";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { execSync, execFileSync, spawnSync } from "child_process";
import { tmpdir } from "os";

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parses a semantic version string into components.
 * Only accepts production versions (no prerelease suffixes).
 */
export function parseVersion(version: string): ParsedVersion | null {
  const pattern = /^(\d+)\.(\d+)\.(\d+)$/;
  const match = version.match(pattern);

  if (!match) return null;

  const [, major, minor, patch] = match;

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
  };
}

/**
 * Calculates the next version based on bump type.
 * @param current - Parsed current version
 * @param bumpType - 'patch', 'minor', 'major', or custom version string
 */
export function calculateNextVersion(current: ParsedVersion, bumpType: string): string {
  if (bumpType === "patch") {
    return `${current.major}.${current.minor}.${current.patch + 1}`;
  }

  if (bumpType === "minor") {
    return `${current.major}.${current.minor + 1}.0`;
  }

  if (bumpType === "major") {
    return `${current.major + 1}.0.0`;
  }

  // Custom version - validate
  const parsed = parseVersion(bumpType);
  if (!parsed) {
    throw new Error("Invalid version format. Must be X.Y.Z");
  }

  return bumpType;
}

interface PackageJson {
  name: string;
  version: string;
  [key: string]: unknown;
}

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  [key: string]: unknown;
}

interface VersionsJson {
  [version: string]: string;
}

/**
 * Reads and parses package.json
 */
export function readPackageJson(): PackageJson {
  const path = join(process.cwd(), "package.json");
  if (!existsSync(path)) {
    throw new Error("package.json not found");
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

/**
 * Reads and parses manifest.json
 */
export function readManifest(): PluginManifest {
  const path = join(process.cwd(), "manifest.json");
  if (!existsSync(path)) {
    throw new Error("manifest.json not found");
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

/**
 * Reads and parses versions.json
 */
export function readVersionsJson(): VersionsJson {
  const path = join(process.cwd(), "versions.json");
  if (!existsSync(path)) {
    throw new Error("versions.json not found");
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

/**
 * Updates all version files with the new version
 */
export function updateVersionFiles(version: string): void {
  const pkg = readPackageJson();
  const manifest = readManifest();
  const versions = readVersionsJson();

  // Update package.json
  pkg.version = version;
  writeFileSync(join(process.cwd(), "package.json"), JSON.stringify(pkg, null, 2) + "\n", "utf-8");

  // Update manifest.json
  manifest.version = version;
  writeFileSync(
    join(process.cwd(), "manifest.json"),
    JSON.stringify(manifest, null, "\t") + "\n",
    "utf-8"
  );

  // Update versions.json
  versions[version] = manifest.minAppVersion;
  writeFileSync(
    join(process.cwd(), "versions.json"),
    JSON.stringify(versions, null, "\t") + "\n",
    "utf-8"
  );
}

/**
 * Checks if git working directory is clean
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
    return false;
  }
}

/**
 * Checks code formatting
 */
export function checkFormatting(): boolean {
  console.log("Checking code formatting...");
  try {
    execSync("npm run format:check", { stdio: "pipe", encoding: "utf-8" });
    console.log("✓ Code formatting is correct\n");
    return true;
  } catch {
    console.error("✗ Code formatting check failed");
    console.error("Run: npm run format\n");
    return false;
  }
}

/**
 * Runs test suite
 */
export function checkTests(): boolean {
  console.log("Running tests...");
  try {
    execSync("npm test", { stdio: "inherit", encoding: "utf-8" });
    console.log("✓ All tests passed\n");
    return true;
  } catch {
    console.error("✗ Tests failed\n");
    return false;
  }
}

/**
 * Runs all pre-flight checks
 */
export function runPreflightChecks(): boolean {
  if (!checkGitStatus()) return false;
  if (!checkGitHubCLI()) return false;
  if (!checkFormatting()) return false;
  if (!checkTests()) return false;
  return true;
}

/**
 * Builds the plugin
 */
export function buildPlugin(): boolean {
  console.log("\nBuilding plugin...");
  try {
    execSync("npm run build", { stdio: "inherit", encoding: "utf-8" });
    console.log("✓ Build completed successfully\n");
    return true;
  } catch {
    console.error("✗ Build failed\n");
    return false;
  }
}

/**
 * Verifies required build files exist
 */
export function verifyBuildFiles(): void {
  const required = ["main.js", "manifest.json"];
  const missing = required.filter((f) => !existsSync(join(process.cwd(), f)));

  if (missing.length > 0) {
    throw new Error(`Missing required build files: ${missing.join(", ")}`);
  }

  if (!existsSync(join(process.cwd(), "styles.css"))) {
    console.log("Note: styles.css not found (plugin may not have styles)");
  }
}

/**
 * Verifies gh CLI is installed and authenticated
 */
export function checkGitHubCLI(): boolean {
  try {
    execSync("gh --version", { encoding: "utf-8", stdio: "pipe" });
  } catch {
    console.error("Error: GitHub CLI (gh) is not installed");
    console.error("Install from: https://cli.github.com/");
    return false;
  }

  try {
    execSync("gh auth status", { encoding: "utf-8", stdio: "pipe" });
    return true;
  } catch {
    console.error("Error: GitHub CLI is not authenticated");
    console.error("Run: gh auth login");
    return false;
  }
}

/**
 * Determines which release assets to include based on file presence
 */
export function getReleaseAssets(): string[] {
  const hasStyles = existsSync(join(process.cwd(), "styles.css"));
  return hasStyles ? ["manifest.json", "main.js", "styles.css"] : ["manifest.json", "main.js"];
}

/**
 * Opens the user's editor to write release notes
 */
export function promptReleaseNotes(version: string): string {
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";
  const tempFile = join(tmpdir(), `flow-release-notes-${version}.md`);

  const template = `# Release ${version}

## What's New

-

## Bug Fixes

-

<!-- Lines starting with # will be kept. Delete sections you don't need. -->
`;

  writeFileSync(tempFile, template, "utf-8");

  console.log(`\nOpening ${editor} for release notes...`);
  console.log("Save and close the editor when done.\n");

  const result = spawnSync(editor, [tempFile], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    unlinkSync(tempFile);
    throw new Error("Editor exited with non-zero status");
  }

  const content = readFileSync(tempFile, "utf-8");
  unlinkSync(tempFile);

  // Remove empty sections and clean up
  const lines = content.split("\n");
  const cleanedLines = lines.filter((line) => {
    // Keep non-empty lines that aren't just "- " placeholder
    const trimmed = line.trim();
    return trimmed !== "-" && trimmed !== "- ";
  });

  return cleanedLines.join("\n").trim();
}

/**
 * Creates GitHub release with assets
 */
export function createGitHubRelease(version: string, releaseNotes: string): boolean {
  const assets = getReleaseAssets();
  const notesFile = join(tmpdir(), `flow-release-notes-${version}-${Date.now()}.md`);

  console.log("Creating GitHub release...\n");

  try {
    writeFileSync(notesFile, releaseNotes, "utf-8");
    execFileSync(
      "gh",
      [
        "release",
        "create",
        version,
        "--title",
        `v${version}`,
        "--notes-file",
        notesFile,
        ...assets,
      ],
      { stdio: "inherit" }
    );
    unlinkSync(notesFile);
    console.log("\n✓ GitHub release created\n");
    return true;
  } catch (error) {
    try {
      unlinkSync(notesFile);
    } catch {
      // Ignore cleanup errors
    }
    console.error("\nError creating GitHub release");
    console.error(error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Prompts user to select version bump type
 */
export function promptVersionBump(current: ParsedVersion): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const patchVersion = `${current.major}.${current.minor}.${current.patch + 1}`;
    const minorVersion = `${current.major}.${current.minor + 1}.0`;
    const majorVersion = `${current.major + 1}.0.0`;

    console.log(`\nCurrent version: ${current.major}.${current.minor}.${current.patch}\n`);
    console.log("Select version bump:");
    console.log(`1) Patch: ${patchVersion}`);
    console.log(`2) Minor: ${minorVersion}`);
    console.log(`3) Major: ${majorVersion}`);
    console.log("4) Custom (enter version manually)\n");

    rl.question("Choice (1/2/3/4): ", (answer) => {
      const choice = answer.trim();

      if (choice === "1") {
        rl.close();
        resolve("patch");
      } else if (choice === "2") {
        rl.close();
        resolve("minor");
      } else if (choice === "3") {
        rl.close();
        resolve("major");
      } else if (choice === "4") {
        rl.question("Enter custom version (format: X.Y.Z): ", (custom) => {
          const trimmed = custom.trim();
          const parsed = parseVersion(trimmed);

          if (!parsed) {
            rl.close();
            reject(new Error("Invalid version format. Must be X.Y.Z"));
            return;
          }

          rl.close();
          resolve(trimmed);
        });
      } else {
        rl.close();
        reject(new Error("Invalid choice. Please enter 1, 2, 3, or 4"));
      }
    });
  });
}

/**
 * Displays planned commands and asks for confirmation
 */
export function confirmRelease(version: string, releaseNotes: string): Promise<boolean> {
  return new Promise((resolve) => {
    const assets = getReleaseAssets().join(" ");

    console.log("\n--- Release Notes Preview ---\n");
    console.log(releaseNotes);
    console.log("\n-----------------------------\n");

    console.log("The following commands will be executed:\n");
    console.log("  git add package.json manifest.json versions.json");
    console.log(`  git commit -m "Release v${version}"`);
    console.log("  git push");
    console.log(`  gh release create ${version} --title "v${version}" ${assets}\n`);

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
 * Commits changes and pushes
 */
export function commitAndPush(version: string): boolean {
  console.log("Committing and pushing...\n");

  try {
    execFileSync("git", ["add", "package.json", "manifest.json", "versions.json"], {
      stdio: "inherit",
    });
    execFileSync("git", ["commit", "-m", `Release v${version}`], {
      stdio: "inherit",
    });
    execFileSync("git", ["push"], { stdio: "inherit" });
    console.log("\n✓ Changes committed and pushed\n");
    return true;
  } catch (error) {
    console.error("\nError during git operations");
    console.error(error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Reverts version file changes
 */
function rollbackVersionFiles(): void {
  execFileSync("git", ["checkout", "package.json", "manifest.json", "versions.json"], {
    stdio: "inherit",
  });
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("\n=== Production Release Workflow ===\n");

  // Pre-flight checks
  if (!runPreflightChecks()) {
    process.exit(1);
  }

  // Read current version
  const pkg = readPackageJson();
  const current = parseVersion(pkg.version);

  if (!current) {
    console.error(
      "Error: Invalid version in package.json (beta versions must be released via release:beta)"
    );
    process.exit(1);
  }

  // Get version bump type
  const bumpType = await promptVersionBump(current);
  const nextVersion = calculateNextVersion(current, bumpType);

  console.log(`\nBumping version: ${pkg.version} → ${nextVersion}\n`);

  // Update version files
  updateVersionFiles(nextVersion);

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

  // Prompt for release notes
  let releaseNotes: string;
  try {
    releaseNotes = promptReleaseNotes(nextVersion);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Reverting version changes...");
    rollbackVersionFiles();
    process.exit(1);
  }

  // Confirm and execute
  const confirmed = await confirmRelease(nextVersion, releaseNotes);
  if (!confirmed) {
    console.log("Release cancelled. Reverting version changes...");
    rollbackVersionFiles();
    process.exit(0);
  }

  // Commit and push
  if (!commitAndPush(nextVersion)) {
    process.exit(1);
  }

  // Create GitHub release (this also creates the tag)
  if (!createGitHubRelease(nextVersion, releaseNotes)) {
    console.error("Release commit was pushed but GitHub release creation failed.");
    console.error(`You can manually create the release: gh release create ${nextVersion}`);
    process.exit(1);
  }

  console.log(`\n✓ Version ${nextVersion} released successfully!\n`);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}
