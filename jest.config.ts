module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleFileExtensions: ['ts', 'tsx', 'js'],
	extensionsToTreatAsEsm: ['.ts'],
	transform: {
		'^.+\\.(ts|tsx)$': ['ts-jest', { isolatedModules: true, useESM: true }],
	},
	testMatch: ['**/tests/**/*.test.(ts|tsx)', '**/*.test.(ts|tsx)'],
}
