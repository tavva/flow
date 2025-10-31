// ABOUTME: Test utilities for generating fake credentials and test data
// ABOUTME: Helps avoid hardcoded strings that trigger security scanners (CWE-547)

/**
 * Generates a clearly fake API key for testing purposes.
 * Uses a recognizable prefix and random suffix to avoid any resemblance to real keys.
 *
 * @param prefix Optional prefix to identify the key type (default: "FAKE_KEY")
 * @returns A fake API key string
 */
export function generateFakeApiKey(prefix: string = "FAKE_KEY"): string {
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${randomSuffix}`;
}

/**
 * Generates a consistent fake API key for tests that need the same key value.
 * This is useful when the same key needs to be referenced multiple times in a test.
 *
 * @param seed A seed string to generate a deterministic key
 * @returns A fake API key string
 */
export function generateDeterministicFakeApiKey(seed: string): string {
  // Simple hash function for deterministic output
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `FAKE_KEY_${Math.abs(hash).toString(36).toUpperCase()}`;
}
