// ABOUTME: Tests for inbox file capture functionality
// ABOUTME: Covers appending text, creating files, and error handling

import * as fs from "fs";
import * as path from "path";
import { capture } from "../src/capture";

describe("Capture", () => {
  const testVaultDir = path.join(__dirname, ".test-vault");
  const inboxFile = "inbox.md";
  const inboxPath = path.join(testVaultDir, inboxFile);

  beforeEach(() => {
    if (fs.existsSync(testVaultDir)) {
      fs.rmSync(testVaultDir, { recursive: true });
    }
    fs.mkdirSync(testVaultDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testVaultDir)) {
      fs.rmSync(testVaultDir, { recursive: true });
    }
  });

  describe("capture", () => {
    it("should append text to existing file", () => {
      fs.writeFileSync(inboxPath, "existing line\n");

      capture(testVaultDir, inboxFile, "new line");

      const content = fs.readFileSync(inboxPath, "utf-8");
      expect(content).toBe("existing line\nnew line\n");
    });

    it("should create new file if missing", () => {
      expect(fs.existsSync(inboxPath)).toBe(false);

      capture(testVaultDir, inboxFile, "first line");

      expect(fs.existsSync(inboxPath)).toBe(true);
      const content = fs.readFileSync(inboxPath, "utf-8");
      expect(content).toBe("first line\n");
    });

    it("should create parent directories if needed", () => {
      const nestedFile = "folder/subfolder/inbox.md";
      const nestedPath = path.join(testVaultDir, nestedFile);

      capture(testVaultDir, nestedFile, "nested line");

      expect(fs.existsSync(nestedPath)).toBe(true);
      const content = fs.readFileSync(nestedPath, "utf-8");
      expect(content).toBe("nested line\n");
    });

    it("should resolve paths relative to vault", () => {
      capture(testVaultDir, inboxFile, "relative line");

      const content = fs.readFileSync(inboxPath, "utf-8");
      expect(content).toBe("relative line\n");
    });

    it("should throw error if vault path invalid", () => {
      expect(() => capture("/nonexistent/vault", inboxFile, "text")).toThrow();
    });
  });
});
