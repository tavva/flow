# Testing Documentation

## Overview

This project uses Jest with ts-jest for testing. The test suite includes unit tests for core functionality and component tests for Ink-based CLI components.

## Test Structure

```
tests/
├── __mocks__/           # Custom mocks for problematic dependencies
│   ├── ink.tsx          # Mock for ink v5 (ESM compatibility)
│   ├── ink-testing-library/  # Mock for ink-testing-library v4 (ESM compatibility)
│   ├── obsidian.ts      # Mock for Obsidian API
│   ├── main.ts          # Mock for plugin main module
│   └── planning.ts      # Mock for planning module
├── components/          # Component tests (Ink CLI components)
├── setup.ts            # Global test setup
└── *.test.ts           # Unit tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run a specific test file
npm test -- MultilineTextarea.test.tsx

# Run tests matching a pattern
npm test -- --testNamePattern="should render"
```

## ESM Compatibility Issues

### The Problem

The project uses **ink v5** and **ink-testing-library v4**, both of which are pure ESM packages. They use modern JavaScript features like `import.meta` that Jest cannot handle in its default CommonJS configuration.

When running tests that import these packages, Jest fails with:

```
SyntaxError: Cannot use 'import.meta' outside a module
```

This is a known limitation of Jest, which has poor ESM support compared to modern test runners like Vitest.

### The Solution

We use **custom mocks** for `ink` and `ink-testing-library` located in `tests/__mocks__/`. These mocks:

1. **Provide minimal implementations** of ink's core components (`Box`, `Text`) and hooks (`useInput`, `useApp`)
2. **Use react-test-renderer** to render components and extract text output
3. **Enable testing** without requiring actual ESM support from Jest
4. **Are deliberately simple** - they don't support full terminal rendering, ANSI colors, or interactive input

### Limitations

The mocked implementations have intentional limitations:

- **No interactive input**: `useInput()` is a no-op. Tests cannot simulate keyboard interaction.
- **No terminal layout**: Layout calculations (yoga-layout) are not performed.
- **No ANSI colors**: Text color props are ignored in test output.
- **Simplified rendering**: Only basic text extraction from component trees.

These limitations are acceptable for our current testing needs, which focus on:

- Verifying components render with correct content
- Testing component props and state logic
- Ensuring text output matches expectations

### Future Migration to Vitest

**When the project matures**, we should migrate from Jest to **Vitest**, which has excellent ESM support. This will allow us to:

1. Remove custom mocks for `ink` and `ink-testing-library`
2. Test with the real implementations
3. Support interactive testing scenarios
4. Reduce test maintenance burden

Until then, the custom mocks provide a pragmatic workaround that allows development to continue without blocking on Jest's ESM limitations.

## Suppressed Warnings

### React Hooks Warning

When running tests, React may generate warnings about hooks being called outside of component context. This happens because:

1. Our mock implementations are minimal and don't fully simulate the Ink rendering environment
2. The warnings are false positives that don't indicate actual problems
3. Tests pass correctly despite the warnings

We suppress these warnings in `tests/setup.ts` to keep test output clean and focused on actual failures.

## Coverage Requirements

The project enforces **80% code coverage** across all metrics:

- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

Coverage is measured only for production code in `src/` and excludes:

- TypeScript definition files (`*.d.ts`)
- Index files that only re-export (`**/index.ts`)

Run `npm run test:coverage` to generate a coverage report.

## Writing Tests

### Component Tests

When testing Ink components:

```typescript
import React from "react";
import { render } from "ink-testing-library";
import { MyComponent } from "../../src/components/MyComponent";

describe("MyComponent", () => {
  it("should render expected output", () => {
    const { lastFrame } = render(<MyComponent message="Hello" />);
    expect(lastFrame()).toContain("Hello");
  });
});
```

**Note**: Due to the custom mock limitations, you can only test:

- Text content in the output
- That components render without crashing
- Basic prop handling

You **cannot** test:

- Interactive keyboard input
- Layout calculations
- Terminal colors in output

### Unit Tests

For non-component code, write standard Jest tests:

```typescript
import { myFunction } from "../src/my-module";

describe("myFunction", () => {
  it("should return expected value", () => {
    expect(myFunction("input")).toBe("output");
  });
});
```

## Common Issues

### "Cannot use 'import.meta' outside a module"

If you see this error, it means:

1. A new dependency uses ESM syntax
2. Jest cannot transform it automatically

**Solution**: Add a custom mock in `tests/__mocks__/` similar to the existing `ink` and `ink-testing-library` mocks.

### Tests pass but show React warnings

If tests pass but display React warnings about hooks:

1. Check that warnings are being suppressed in `tests/setup.ts`
2. Verify the warning isn't indicating an actual problem in production code
3. If it's a false positive from mocks, document and suppress it

### Mock not being used

Jest's module resolution order:

1. Manual mocks in `tests/__mocks__/`
2. Node modules in `node_modules/`

If your mock isn't being used:

1. Verify it's in the correct location: `tests/__mocks__/<package-name>/`
2. Restart Jest (watch mode doesn't always pick up new mocks)
3. Check for typos in the package name

## Test Maintenance

### When to Update Mocks

Update the custom mocks when:

1. New ink components or hooks are needed in tests
2. Component tests require additional functionality
3. ink or ink-testing-library APIs change

### When to Remove Mocks

Remove the custom mocks when:

1. The project migrates to Vitest
2. Jest adds proper ESM support (unlikely in the near future)
3. We decide to avoid testing Ink components directly

## Additional Resources

- [Jest ESM Support](https://jestjs.io/docs/ecmascript-modules) - Official documentation (limited)
- [Vitest](https://vitest.dev/) - Modern test runner with excellent ESM support
- [ink Documentation](https://github.com/vadimdemedes/ink) - ink v5 documentation
- [react-test-renderer](https://react.dev/reference/react/react-test-renderer) - Used by our custom mocks
