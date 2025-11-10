// ABOUTME: Integration tests for CLI entry point
// ABOUTME: Tests argument parsing, orchestration, and error messages

import * as fs from "fs";
import * as path from "path";

// Mock console methods
const mockConsoleLog = jest.spyOn(console, "log").mockImplementation();
const mockConsoleError = jest.spyOn(console, "error").mockImplementation();
const mockProcessExit = jest.spyOn(process, "exit").mockImplementation();

// Import after mocking
import { parseArgs, main } from "../src/index";

describe("CLI Entry Point", () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  describe("parseArgs", () => {
    it("should parse text argument", () => {
      const args = parseArgs(["buy milk"]);
      expect(args.text).toBe("buy milk");
      expect(args.vault).toBeUndefined();
      expect(args.config).toBe(false);
    });

    it("should parse --vault flag", () => {
      const args = parseArgs(["--vault", "/path/to/vault", "buy milk"]);
      expect(args.text).toBe("buy milk");
      expect(args.vault).toBe("/path/to/vault");
    });

    it("should parse --config flag", () => {
      const args = parseArgs(["--config"]);
      expect(args.config).toBe(true);
      expect(args.text).toBeUndefined();
    });

    it("should throw error if no text provided", () => {
      expect(() => parseArgs([])).toThrow("Please provide text to capture");
    });

    it("should allow --config without text", () => {
      const args = parseArgs(["--config"]);
      expect(args.config).toBe(true);
    });
  });
});
