module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleFileExtensions: ['ts', 'tsx', 'js'],
	// transform: {
	// 	'^.+\\.(ts|tsx)$': 'ts-jest',
	// },
	testMatch: ['**/tests/**/*.test.(ts|tsx)', '**/*.test.(ts|tsx)'],
}
