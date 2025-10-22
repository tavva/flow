// ABOUTME: Custom mock for ink v5 to work around Jest's poor ESM support.
// ABOUTME: ink v5 is pure ESM and uses import.meta, which Jest cannot handle in default configuration.
//
// This mock provides minimal implementations of ink's core components and hooks
// sufficient for testing our CLI components. When the project migrates to Vitest
// (which has proper ESM support), this mock can be removed.
//
// See tests/README.md for more details on the testing approach.

import React from "react";

// Mock Box component - renders children with flexDirection applied
export const Box: React.FC<{
  children?: React.ReactNode;
  flexDirection?: "row" | "column";
  marginTop?: number;
  marginBottom?: number;
}> = ({ children }) => {
  return <div data-testid="box">{children}</div>;
};

// Mock Text component - renders text content with optional color
export const Text: React.FC<{
  children?: React.ReactNode;
  color?: string;
  bold?: boolean;
  dimColor?: boolean;
}> = ({ children }) => {
  return <span data-testid="text">{children}</span>;
};

// Mock useInput hook - provides keyboard input handling
// In tests, this is a no-op since we don't test actual keyboard interaction
export const useInput = jest.fn();

// Mock useApp hook - provides access to the Ink app instance
export const useApp = jest.fn(() => ({
  exit: jest.fn(),
}));

// Mock render function - actually uses ink-testing-library's render
// This is re-exported here for convenience
export { render } from "ink-testing-library";
