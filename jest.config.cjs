module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(?:\\.{1,2}/)*main\\.js$': '<rootDir>/tests/__mocks__/main.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { useESM: true }],
  },
  testMatch: ['**/tests/**/*.test.(ts|tsx)', '**/*.test.(ts|tsx)'],
}
