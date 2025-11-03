import { MockVault } from "./mock-vault";
import { VaultContext } from "./types";

describe("MockVault", () => {
  it("creates vault with project files", () => {
    const context: VaultContext = {
      projects: [
        {
          title: "Test Project",
          status: "live",
          sphere: "work",
          nextActions: ["Action 1", "Action 2"],
          priority: 2,
          creationDate: "2025-01-01",
        },
      ],
      nextActions: [],
      somedayItems: [],
    };

    const mockVault = new MockVault(context);
    const files = mockVault.getAllFiles();

    expect(files.length).toBeGreaterThan(0);
    const projectFile = files.find((f) => f.path.includes("Test Project"));
    expect(projectFile).toBeDefined();

    if (projectFile) {
      const content = mockVault.getFileContent(projectFile.path);
      expect(content).toContain("Test Project");
      expect(content).toContain("Action 1");
    }
  });
});
