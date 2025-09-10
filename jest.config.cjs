module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^\.\./src/(.*)\\.js$': '<rootDir>/src/$1.ts',
    '^\.\/utils\\.js$': '<rootDir>/src/utils.ts',
    '^\.\/processing\\.js$': '<rootDir>/src/processing.ts',
    '^\.\/views\/(.*)\\.js$': '<rootDir>/src/views/$1.ts',
    '^\.\/main\\.js$': '<rootDir>/tests/__mocks__/main.ts',
    '^\.\./\.\./main\\.js$': '<rootDir>/tests/__mocks__/main.ts',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { isolatedModules: true, useESM: true }],
  },
  testMatch: ['**/tests/**/*.test.(ts|tsx)', '**/*.test.(ts|tsx)'],
}
