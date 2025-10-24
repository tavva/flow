// ABOUTME: Test setup file to configure global mocks and make Obsidian classes
// ABOUTME: available for instanceof checks across all test files.

// Set up a minimal DOM environment for tests that need it
if (typeof document === "undefined") {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  (global as any).document = dom.window.document;
  (global as any).window = dom.window;
  (global as any).HTMLElement = dom.window.HTMLElement;
}

// Mock obsidian module globally
jest.mock("obsidian");

// Import the mocked classes and make them globally available
import { TFile } from "obsidian";
import { resetSharedAnthropicClient } from "../src/anthropic-client";

// Make TFile available globally for instanceof checks
(global as any).TFile = TFile;

// Suppress React warnings that are false positives from our minimal Ink mocks
// The custom mocks in tests/__mocks__/ink.tsx don't fully simulate the Ink
// rendering environment, which can trigger React warnings about hooks being
// called outside of component context. These warnings are false positives and
// don't indicate actual problems in our production code.
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Suppress specific React warnings that come from our mock environment
  const errorString = args[0]?.toString() || "";
  if (
    errorString.includes("Invalid hook call") ||
    errorString.includes("Hooks can only be called inside") ||
    errorString.includes("Warning: Invalid hook call") ||
    errorString.includes("not wrapped in act(")
  ) {
    return;
  }
  // Pass through all other errors
  originalConsoleError.apply(console, args);
};

// Ensure all timers and API clients are cleaned up after each test
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllTimers();
  resetSharedAnthropicClient();
});
