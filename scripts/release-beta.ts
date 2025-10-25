// ABOUTME: Beta release script for creating and publishing versioned beta releases.
// ABOUTME: Handles version parsing, calculation, and GitHub release creation via BRAT.

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
