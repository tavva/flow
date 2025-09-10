module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^\.\./src/(.*)\\.js$': '<rootDir>/src/$1.ts',
    '^\.\/main\\.js$': '<rootDir>/src/main.ts',
    '^\.\./\.\./main\\.js$': '<rootDir>/src/main.ts',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { isolatedModules: true, useESM: true }],
  },
  testMatch: ['**/tests/**/*.test.(ts|tsx)', '**/*.test.(ts|tsx)'],
}
