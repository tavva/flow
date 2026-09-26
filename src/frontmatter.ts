// ABOUTME: Reads typed values from note frontmatter, which Obsidian exposes untyped.
// ABOUTME: Normalises tags and finds a project's sphere from its project/* tags.

export type Frontmatter = Record<string, unknown>;

const PROJECT_TAG_PREFIX = "project/";

/**
 * Returns the frontmatter tags as an array, accepting a single tag or a list
 */
export function getFrontmatterTags(frontmatter: Frontmatter | undefined): string[] {
  const tags = frontmatter?.tags;
  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => typeof tag === "string");
  }
  if (typeof tags === "string") {
    return [tags];
  }
  return [];
}

export function getFrontmatterString(
  frontmatter: Frontmatter | undefined,
  key: string
): string | undefined {
  const value = frontmatter?.[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Returns a numeric frontmatter value, accepting numbers written as strings
 */
export function getFrontmatterNumber(
  frontmatter: Frontmatter | undefined,
  key: string
): number | undefined {
  const value = frontmatter?.[key];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Returns the sphere named by the first project/* tag (e.g. "work" for #project/work)
 */
export function getProjectSphere(frontmatter: Frontmatter | undefined): string | null {
  for (const tag of getFrontmatterTags(frontmatter)) {
    const normalizedTag = tag.replace(/^#/, "");
    if (normalizedTag.startsWith(PROJECT_TAG_PREFIX)) {
      const sphere = normalizedTag.slice(PROJECT_TAG_PREFIX.length);
      if (sphere) {
        return sphere;
      }
    }
  }
  return null;
}
