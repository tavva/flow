import { buildProjectTitlePrompt } from "../src/project-title-prompt";

describe("buildProjectTitlePrompt", () => {
  it("includes the original inbox item and clear guidance", () => {
    const prompt = buildProjectTitlePrompt("Organize files");

    expect(prompt).toContain("Organize files");
    expect(prompt).toContain("Respond with ONLY the project title");
    expect(prompt.startsWith("Given this inbox item")).toBe(true);
  });
});
