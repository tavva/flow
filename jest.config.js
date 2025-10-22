module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts", "**/?(*.)+(spec|test).tsx"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.test.json",
        isolatedModules: true,
      },
    ],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(ink|ink-testing-library|chalk|ansi-escapes|ansi-styles|cli-cursor|cli-boxes|widest-line|wrap-ansi|string-width|strip-ansi|ansi-regex|yoga-wasm-web)/)",
  ],
  moduleNameMapper: {
    "^ink-testing-library$": "<rootDir>/tests/__mocks__/ink-testing-library",
  },
  collectCoverageFrom: ["src/**/*.ts", "src/**/*.tsx", "!src/**/*.d.ts", "!src/**/index.ts"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
};
