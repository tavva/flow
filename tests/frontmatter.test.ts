// ABOUTME: Tests typed frontmatter readers used by scanners and views.
// ABOUTME: Covers tag normalisation, string/number reads and project sphere lookup.

import {
  getFrontmatterNumber,
  getFrontmatterString,
  getFrontmatterTags,
  getProjectSphere,
} from "../src/frontmatter";

describe("frontmatter readers", () => {
  describe("getFrontmatterTags", () => {
    it("returns a list of tags as-is, dropping non-string entries", () => {
      expect(getFrontmatterTags({ tags: ["project/work", 42, null, "person"] })).toEqual([
        "project/work",
        "person",
      ]);
    });

    it("wraps a single tag string in a list", () => {
      expect(getFrontmatterTags({ tags: "person" })).toEqual(["person"]);
    });

    it("returns no tags when tags are missing or malformed", () => {
      expect(getFrontmatterTags(undefined)).toEqual([]);
      expect(getFrontmatterTags({})).toEqual([]);
      expect(getFrontmatterTags({ tags: { nested: true } })).toEqual([]);
    });
  });

  describe("getFrontmatterString", () => {
    it("returns string values", () => {
      expect(getFrontmatterString({ status: "live" }, "status")).toBe("live");
    });

    it("ignores missing and non-string values", () => {
      expect(getFrontmatterString(undefined, "status")).toBeUndefined();
      expect(getFrontmatterString({ status: 3 }, "status")).toBeUndefined();
      expect(getFrontmatterString({ status: ["live"] }, "status")).toBeUndefined();
    });
  });

  describe("getFrontmatterNumber", () => {
    it("returns numbers and numeric strings", () => {
      expect(getFrontmatterNumber({ priority: 2 }, "priority")).toBe(2);
      expect(getFrontmatterNumber({ priority: "3" }, "priority")).toBe(3);
    });

    it("ignores missing, blank and non-numeric values", () => {
      expect(getFrontmatterNumber(undefined, "priority")).toBeUndefined();
      expect(getFrontmatterNumber({ priority: "" }, "priority")).toBeUndefined();
      expect(getFrontmatterNumber({ priority: "high" }, "priority")).toBeUndefined();
      expect(getFrontmatterNumber({ priority: true }, "priority")).toBeUndefined();
    });
  });

  describe("getProjectSphere", () => {
    it("returns the sphere from the first project tag, with or without #", () => {
      expect(getProjectSphere({ tags: ["person", "#project/work", "project/home"] })).toBe("work");
      expect(getProjectSphere({ tags: "project/personal" })).toBe("personal");
    });

    it("returns null when there is no usable project tag", () => {
      expect(getProjectSphere(undefined)).toBeNull();
      expect(getProjectSphere({ tags: ["person"] })).toBeNull();
      expect(getProjectSphere({ tags: ["project/"] })).toBeNull();
    });
  });
});
