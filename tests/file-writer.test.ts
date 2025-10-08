import { FileWriter } from "../src/file-writer";
import {
  GTDProcessingResult,
  PluginSettings,
  FlowProject,
  PersonNote,
} from "../src/types";

// Import mocked obsidian
jest.mock("obsidian");
import { App, TFile, Vault, FileManager } from "obsidian";

describe("FileWriter", () => {
  let fileWriter: FileWriter;
  let mockApp: Partial<App>;
  let mockVault: Partial<Vault>;
  let mockFileManager: Partial<FileManager>;
  const mockSettings: PluginSettings = {
    anthropicApiKey: "test-key",
    defaultPriority: 2,
    defaultStatus: "live",
    inboxFilesFolderPath: "Flow Inbox Files",
    inboxFolderPath: "Flow Inbox Folder",
    nextActionsFilePath: "Next actions.md",
    somedayFilePath: "Someday.md",
    projectsFolderPath: "Projects",
    spheres: ["personal", "work"],
  };

  beforeEach(() => {
    mockVault = {
      create: jest.fn(),
      modify: jest.fn(),
      read: jest.fn(),
      getAbstractFileByPath: jest.fn(),
      createFolder: jest.fn().mockResolvedValue(undefined),
    };

    mockFileManager = {
      processFrontMatter: jest.fn(),
    };

    mockApp = {
      vault: mockVault as Vault,
      fileManager: mockFileManager as FileManager,
    };

    fileWriter = new FileWriter(mockApp as App, mockSettings);
  });

  describe("createProject", () => {
    it("should create a new project file with proper frontmatter", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "Website Redesign Complete",
        nextAction: "Meet with designer to discuss requirements",
        reasoning: "This is a multi-step project requiring coordination",
        futureActions: [
          "Review mockups",
          "Implement design",
          "Deploy to production",
        ],
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Multi-step project",
      };

      const mockFile = new TFile(
        "Website-Redesign-Complete.md",
        "Website Redesign Complete",
      );
      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation(
        (path: string) => {
          if (path === "Projects") {
            return {};
          }

          return null;
        },
      );
      (mockVault.create as jest.Mock).mockResolvedValue(mockFile);

      const file = await fileWriter.createProject(result, "redesign website");

      expect(mockVault.create).toHaveBeenCalled();
      const [filePath, content] = (mockVault.create as jest.Mock).mock.calls[0];

      expect(filePath).toBe("Projects/Website Redesign Complete.md");
      expect(content).toContain("# Website Redesign Complete");
      expect(content).toContain("priority: 2");
      expect(content).toContain("status: live");
      expect(content).toContain("tags: project/personal");
      expect(content).toContain("## Next actions");
      expect(content).toContain(
        "- [ ] Meet with designer to discuss requirements",
      );
      expect(content).toContain("## Future next actions");
      expect(content).toContain("- [ ] Review mockups");
      expect(content).toContain("- [ ] Implement design");
      expect(file).toBe(mockFile);
    });

    it("should strip only disallowed characters while preserving spaces", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "My Cool Project! (v2.0)",
        nextAction: "Start",
        reasoning: "Test",
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Test",
      };

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation(
        (path: string) => {
          if (path === "Projects") {
            return {};
          }

          return null;
        },
      );
      (mockVault.create as jest.Mock).mockResolvedValue(
        new TFile("test.md", "test"),
      );

      await fileWriter.createProject(result, "test");

      const [filePath] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(filePath).toBe("Projects/My Cool Project! (v2.0).md");
    });

    it("should keep spaces while stripping disallowed filename characters", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "Quarterly / Planning: Q1*",
        nextAction: "Outline agenda",
        reasoning: "Test",
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Test",
      };

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation(
        (path: string) => {
          if (path === "Projects") {
            return {};
          }

          return null;
        },
      );
      (mockVault.create as jest.Mock).mockResolvedValue(
        new TFile("test.md", "test"),
      );

      await fileWriter.createProject(result, "fallback");

      const [filePath] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(filePath).toBe("Projects/Quarterly Planning Q1.md");
    });

    it("should throw error if file already exists", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "Existing Project",
        nextAction: "Do something",
        reasoning: "Test",
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Test",
      };

      const existingFile = new TFile(
        "Projects/Existing Project.md",
        "Existing Project",
      );
      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation(
        (path: string) => {
          if (path === "Projects") {
            return {};
          }

          if (path === "Projects/Existing Project.md") {
            return existingFile;
          }

          return null;
        },
      );

      await expect(fileWriter.createProject(result, "test")).rejects.toThrow(
        "File Projects/Existing Project.md already exists",
      );
    });

    it("should handle empty future actions", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "Simple Project",
        nextAction: "First action",
        reasoning: "Test",
        futureActions: [],
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Test",
      };

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation(
        (path: string) => {
          if (path === "Projects") {
            return {};
          }

          return null;
        },
      );
      (mockVault.create as jest.Mock).mockResolvedValue({} as TFile);

      await fileWriter.createProject(result, "test");

      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toContain("## Future next actions\n");
      expect(content).not.toContain("- undefined");
    });

    it("should use original item as title if projectOutcome is missing", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        nextAction: "Do something",
        reasoning: "Test",
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Test",
      };

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation(
        (path: string) => {
          if (path === "Projects") {
            return {};
          }

          return null;
        },
      );
      (mockVault.create as jest.Mock).mockResolvedValue({} as TFile);

      await fileWriter.createProject(result, "My Original Item");

      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toContain("# My Original Item");
    });

    it("should include creation date in proper format", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "Test Project",
        nextAction: "Do something",
        reasoning: "Test",
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Test",
      };

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation(
        (path: string) => {
          if (path === "Projects") {
            return {};
          }

          return null;
        },
      );
      (mockVault.create as jest.Mock).mockResolvedValue({} as TFile);

      await fileWriter.createProject(result, "test");

      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      // Should match format: YYYY-MM-DD HH:mm
      expect(content).toMatch(/creation-date: \d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    });

    it("should create project folder when it does not exist", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "New Project",
        nextAction: "Start work",
        reasoning: "Test",
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Test",
      };

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation(
        (path: string) => {
          if (path === "Projects") {
            return null;
          }

          return null;
        },
      );
      (mockVault.create as jest.Mock).mockResolvedValue({} as TFile);

      await fileWriter.createProject(result, "test");

      expect(mockVault.createFolder).toHaveBeenCalledWith("Projects");
    });
  });

  describe("addNextActionToProject", () => {
    const mockProject: FlowProject = {
      file: "project.md",
      title: "Test Project",
      tags: ["project/personal"],
      nextActions: ["Existing action"],
      futureNextActions: [],
    };

    it("should add action to existing Next actions section", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      const existingContent = `---
tags: project/personal
---

# Test Project

## Next actions
- Existing action

## Future next actions
`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addNextActionToProject(mockProject, "New action", false);

      expect(mockVault.modify).toHaveBeenCalled();
      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("- [ ] New action");
      expect(newContent).toContain("- Existing action");
    });

    it("should add action to Future next actions section when isFuture is true", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      const existingContent = `## Next actions
- Current action

## Future next actions
- Future action 1
`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addNextActionToProject(
        mockProject,
        "New future action",
        true,
      );

      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("## Future next actions");
      expect(newContent).toContain("- [ ] New future action");
      expect(newContent).toContain("- Future action 1");
    });

    it("should create section if it does not exist", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      const existingContent = `---
tags: project/personal
---

# Test Project

Some content here.
`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addNextActionToProject(
        mockProject,
        "First action",
        false,
      );

      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("## Next actions");
      expect(newContent).toContain("- [ ] First action");
    });

    it("should throw error if project file not found", async () => {
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      await expect(
        fileWriter.addNextActionToProject(mockProject, "New action"),
      ).rejects.toThrow("Project file not found: project.md");
    });

    it("should handle empty sections correctly", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      const existingContent = `## Next actions

## Future next actions
- Future action
`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addNextActionToProject(mockProject, "New action", false);

      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("## Next actions");
      expect(newContent).toContain("- [ ] New action");
    });

    it("should preserve section structure when adding to middle section", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      const existingContent = `# Project

## Next actions
- Action 1

## Notes
Some notes here

## Future next actions
- Future 1
`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addNextActionToProject(mockProject, "New action", false);

      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("## Next actions");
      expect(newContent).toContain("- [ ] New action");
      expect(newContent).toContain("## Notes");
      expect(newContent).toContain("Some notes here");
    });
  });

  describe("updateProjectTags", () => {
    const mockProject: FlowProject = {
      file: "project.md",
      title: "Test Project",
      tags: ["project/personal"],
      nextActions: [],
      futureNextActions: [],
    };

    it("should update project tags using processFrontMatter", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

      let frontmatterCallback: any;
      (mockFileManager.processFrontMatter as jest.Mock).mockImplementation(
        (file, callback) => {
          frontmatterCallback = callback;
          const mockFrontmatter = { tags: ["project/personal", "urgent"] };
          callback(mockFrontmatter);
          return Promise.resolve();
        },
      );

      await fileWriter.updateProjectTags(mockProject, ["project/work"]);

      expect(mockFileManager.processFrontMatter).toHaveBeenCalled();
    });

    it("should preserve existing project tags", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

      let resultTags: string[] = [];
      (mockFileManager.processFrontMatter as jest.Mock).mockImplementation(
        (file, callback) => {
          const mockFrontmatter = {
            tags: ["project/personal", "project/health", "urgent"],
          };
          callback(mockFrontmatter);
          resultTags = mockFrontmatter.tags;
          return Promise.resolve();
        },
      );

      await fileWriter.updateProjectTags(mockProject, ["important"]);

      expect(resultTags).toContain("project/personal");
      expect(resultTags).toContain("project/health");
    });

    it("should handle string tag format", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

      let resultTags: string[] = [];
      (mockFileManager.processFrontMatter as jest.Mock).mockImplementation(
        (file, callback) => {
          const mockFrontmatter = { tags: "project/personal" };
          callback(mockFrontmatter);
          resultTags = mockFrontmatter.tags;
          return Promise.resolve();
        },
      );

      await fileWriter.updateProjectTags(mockProject, ["urgent"]);

      expect(Array.isArray(resultTags)).toBe(true);
      expect(resultTags).toContain("project/personal");
    });

    it("should throw error if project file not found", async () => {
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      await expect(
        fileWriter.updateProjectTags(mockProject, ["new-tag"]),
      ).rejects.toThrow("Project file not found: project.md");
    });
  });

  describe("addToPersonDiscussNext", () => {
    const mockPerson: PersonNote = {
      file: "people/John Doe.md",
      title: "John Doe",
      tags: ["person"],
    };

    it('should add item to existing "## Discuss next" section', async () => {
      const mockFile = new TFile();
      const existingContent = `---
tags:
  - person
---

# John Doe

## Discuss next
- [ ] Previous item

## Notes
Some notes here`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addToPersonDiscussNext(
        mockPerson,
        "New discussion topic",
      );

      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("## Discuss next");
      expect(newContent).toContain("- [ ] New discussion topic");
      expect(newContent).toContain("- [ ] Previous item");
      expect(newContent).toContain("## Notes");
    });

    it('should create "## Discuss next" section if it does not exist', async () => {
      const mockFile = new TFile();
      const existingContent = `---
tags:
  - person
---

# John Doe

## Notes
Some notes here`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addToPersonDiscussNext(
        mockPerson,
        "First discussion topic",
      );

      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("## Discuss next");
      expect(newContent).toContain("- [ ] First discussion topic");
      expect(newContent).toContain("## Notes");
    });

    it("should handle person note with no existing sections", async () => {
      const mockFile = new TFile();
      const existingContent = `---
tags:
  - person
---

# John Doe

Basic person note content.`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addToPersonDiscussNext(
        mockPerson,
        "New topic to discuss",
      );

      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("## Discuss next");
      expect(newContent).toContain("- [ ] New topic to discuss");
      expect(newContent).toContain("Basic person note content.");
    });

    it("should throw error if person file not found", async () => {
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      await expect(
        fileWriter.addToPersonDiscussNext(mockPerson, "Some topic"),
      ).rejects.toThrow("Person file not found: people/John Doe.md");
    });

    it("should insert item at the beginning of the section", async () => {
      const mockFile = new TFile();
      const existingContent = `---
tags:
  - person
---

# John Doe

## Discuss next

- [ ] Existing item 1
- [ ] Existing item 2

## Notes
Some notes here`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addToPersonDiscussNext(mockPerson, "Urgent new topic");

      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      // Check that the new item appears before existing items
      const newTopicIndex = newContent.indexOf("- [ ] Urgent new topic");
      const existingItem1Index = newContent.indexOf("- [ ] Existing item 1");

      expect(newTopicIndex).toBeLessThan(existingItem1Index);
      expect(newContent).toContain("- [ ] Urgent new topic");
      expect(newContent).toContain("- [ ] Existing item 1");
      expect(newContent).toContain("- [ ] Existing item 2");
    });
  });
});
