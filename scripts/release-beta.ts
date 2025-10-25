// ABOUTME: Beta release script for creating and publishing versioned beta releases.
// ABOUTME: Handles version parsing, calculation, and GitHub release creation via BRAT.

import * as readline from 'readline';

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
		isBeta: betaNumber !== undefined
	};
}

/**
 * Calculates the next version based on current version and bump type
 * @param current - Parsed current version
 * @param bumpType - 'auto' for beta increment, 'patch', 'minor', or custom version
 * @returns Next version string
 */
export function calculateNextVersion(
	current: ParsedVersion | null,
	bumpType: string
): string {
	if (!current) {
		// Validate custom version when current is null
		const parsed = parseVersion(bumpType);
		if (!parsed) {
			throw new Error('Invalid custom version');
		}
		return bumpType;
	}

	if (bumpType === 'auto') {
		// Validate that we're auto-incrementing a beta version
		if (!current.isBeta) {
			throw new Error('Cannot auto-increment beta number on production version');
		}
		// Auto-increment beta number (using non-null assertion since we know it exists)
		return `${current.major}.${current.minor}.${current.patch}-beta.${current.betaNumber! + 1}`;
	}

	if (bumpType === 'patch') {
		return `${current.major}.${current.minor}.${current.patch + 1}-beta.1`;
	}

	if (bumpType === 'minor') {
		return `${current.major}.${current.minor + 1}.0-beta.1`;
	}

	// Custom version - validate and return
	const parsed = parseVersion(bumpType);
	if (!parsed) {
		throw new Error('Invalid custom version');
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
			output: process.stdout
		});

		// Calculate what each option would result in
		const patchVersion = `${current.major}.${current.minor}.${current.patch + 1}-beta.1`;
		const minorVersion = `${current.major}.${current.minor + 1}.0-beta.1`;

		console.log(`\nCurrent version: ${current.major}.${current.minor}.${current.patch}\n`);
		console.log('Select version bump:');
		console.log(`1) Patch: ${patchVersion}`);
		console.log(`2) Minor: ${minorVersion}`);
		console.log('3) Custom (enter version manually)\n');

		rl.question('Choice (1/2/3): ', (answer) => {
			const choice = answer.trim();

			if (choice === '1') {
				rl.close();
				resolve('patch');
			} else if (choice === '2') {
				rl.close();
				resolve('minor');
			} else if (choice === '3') {
				rl.question('Enter custom version (format: X.Y.Z-beta.N): ', (customVersion) => {
					const trimmed = customVersion.trim();
					const parsed = parseVersion(trimmed);

					if (!parsed || !parsed.isBeta) {
						rl.close();
						reject(new Error('Invalid version format. Must be X.Y.Z-beta.N'));
						return;
					}

					rl.close();
					resolve(trimmed);
				});
			} else {
				rl.close();
				reject(new Error('Invalid choice. Please enter 1, 2, or 3'));
			}
		});
	});
}
