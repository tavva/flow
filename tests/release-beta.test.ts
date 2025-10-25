// tests/release-beta.test.ts
import { parseVersion, calculateNextVersion } from '../scripts/release-beta';

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
