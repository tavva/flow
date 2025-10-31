import { scanReviewProtocols } from "../src/protocol-scanner";
import * as fs from "fs";
import * as path from "path";

jest.mock("fs");

describe("scanReviewProtocols", () => {
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty array when reviews directory does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = scanReviewProtocols("/test/vault");

    expect(result).toEqual([]);
  });

  it("scans and returns markdown files from reviews directory", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      "friday-review.md",
      "monday-review.md",
      "notes.txt", // Should be filtered out
    ] as any);
    mockFs.readFileSync.mockImplementation((filePath: any) => {
      if (filePath.includes("friday-review.md")) {
        return "---\ntrigger:\n  day: friday\n  time: afternoon\n---\n# Friday Review\n\nReview content here";
      }
      if (filePath.includes("monday-review.md")) {
        return "# Monday Review\n\nNo frontmatter here";
      }
      return "";
    });

    const result = scanReviewProtocols("/test/vault");

    expect(result).toHaveLength(2);
    expect(result[0].filename).toBe("friday-review.md");
    expect(result[0].name).toBe("Friday Review");
    expect(result[0].trigger?.day).toBe("friday");
    expect(result[0].trigger?.time).toBe("afternoon");
    expect(result[0].content).toContain("Review content here");

    expect(result[1].filename).toBe("monday-review.md");
    expect(result[1].name).toBe("Monday Review");
    expect(result[1].trigger).toBeUndefined();
  });

  it("handles invalid YAML frontmatter gracefully", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(["invalid.md"] as any);
    mockFs.readFileSync.mockReturnValue("---\ninvalid: yaml: structure:\n---\n# Invalid");

    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

    const result = scanReviewProtocols("/test/vault");

    expect(result).toHaveLength(0);
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it("uses filename when no H1 heading present", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(["no-heading.md"] as any);
    mockFs.readFileSync.mockReturnValue("Just some content without heading");

    const result = scanReviewProtocols("/test/vault");

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("no-heading");
  });

  it("skips empty files", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(["empty.md"] as any);
    mockFs.readFileSync.mockReturnValue("");

    const result = scanReviewProtocols("/test/vault");

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("");
  });

  it("handles protocol with spheres in frontmatter", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(["with-spheres.md"] as any);
    mockFs.readFileSync.mockReturnValue("---\nspheres:\n  - work\n  - personal\n---\n# Review");

    const result = scanReviewProtocols("/test/vault");

    expect(result).toHaveLength(1);
    expect(result[0].spheres).toEqual(["work", "personal"]);
  });
});
