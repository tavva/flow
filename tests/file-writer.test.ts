import { FileWriter } from "../src/file-writer";
import { GTDProcessingResult, PluginSettings, FlowProject, PersonNote } from "../src/types";
import { EditableItem } from "../src/inbox-types";

// Import mocked obsidian
jest.mock("obsidian");
import { App, TFile, Vault, FileManager } from "obsidian";

describe("FileWriter", () => {
  let fileWriter: FileWriter;
  let mockApp: Partial<App>;
  let mockVault: Partial<Vault>;
  let mockFileManager: Partial<FileManager>;
  const mockSettings: PluginSettings = {
    llmProvider: "anthropic",
    anthropicApiKey: "test-key",
    anthropicModel: "claude-sonnet-4-20250514",
    openaiApiKey: "",
    openaiBaseUrl: "https://openrouter.ai/api/v1",
    openaiModel: "openrouter/anthropic/claude-3.5-sonnet",
    defaultPriority: 2,
    defaultStatus: "live",
    inboxFilesFolderPath: "Flow Inbox Files",
    inboxFolderPath: "Flow Inbox Folder",
    nextActionsFilePath: "Next actions.md",
    somedayFilePath: "Someday.md",
    projectsFolderPath: "Projects",
    projectTemplateFilePath: "Templates/Project.md",
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
        nextActions: [
          "Meet with designer to discuss requirements",
          "Review mockups",
          "Implement design",
        ],
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Multi-step project",
      };

      const mockFile = new TFile("Website-Redesign-Complete.md", "Website Redesign Complete");
      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === "Projects") {
          return {};
        }

        return null;
      });
      (mockVault.create as jest.Mock).mockResolvedValue(mockFile);

      const file = await fileWriter.createProject(result, "redesign website");

      expect(mockVault.create).toHaveBeenCalled();
      const [filePath, content] = (mockVault.create as jest.Mock).mock.calls[0];

      expect(filePath).toBe("Projects/Website Redesign Complete.md");
      expect(content).toContain("# Description");
      expect(content).toContain("priority:\n  2");
      expect(content).toContain("status: live");
      expect(content).toContain("tags:\n  - project/personal");
      expect(content).toContain("## Next actions");
      expect(content).toContain("Original inbox item: redesign website");
      expect(content).toContain("- [ ] Meet with designer to discuss requirements");
      expect(content).toContain("- [ ] Review mockups");
      expect(content).toContain("- [ ] Implement design");
      expect(content).not.toContain("Future next actions");
      expect(file).toBe(mockFile);
    });

    it("applies a custom project priority when provided", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "Website Redesign Complete",
        nextAction: "Meet with designer to discuss requirements",
        reasoning: "This is a multi-step project requiring coordination",
        nextActions: [
          "Meet with designer to discuss requirements",
          "Review mockups",
          "Implement design",
        ],
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Multi-step project",
        projectPriority: 4,
      };

      const mockFile = new TFile("Website-Redesign-Complete.md", "Website Redesign Complete");
      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === "Projects") {
          return {};
        }

        return null;
      });
      (mockVault.create as jest.Mock).mockResolvedValue(mockFile);

      await fileWriter.createProject(result, "redesign website");

      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toContain("priority:\n  4");
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

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === "Projects") {
          return {};
        }

        return null;
      });
      (mockVault.create as jest.Mock).mockResolvedValue(new TFile("test.md", "test"));

      await fileWriter.createProject(result, "test");

      const [filePath] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(filePath).toBe("Projects/My Cool Project! (v2.0).md");
    });

    it("should include sanitized original inbox description when using template", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "Template Based Project",
        nextAction: "Draft plan",
        reasoning: "Requires planning",
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Needs structure",
      };

      const templateFile = new TFile("Templates/Project.md", "Project template");
      const templateContent = `---
creation-date: <% tp.date.now("YYYY-MM-DD HH:mm") %>
priority:
  {{ priority }}
tags:
  - {{ sphere }}
status: live
---

# Description

{{ description }}

## Next actions
`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === "Projects") {
          return {};
        }

        if (path === "Templates/Project.md") {
          return templateFile;
        }

        return null;
      });
      (mockVault.read as jest.Mock).mockResolvedValue(templateContent);
      (mockVault.create as jest.Mock).mockResolvedValue(
        new TFile("Projects/Template Based Project.md", "Template Based Project")
      );

      await fileWriter.createProject(result, "Call   Bob\nabout the   new contract");

      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toContain("Original inbox item: Call Bob about the new contract");
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

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === "Projects") {
          return {};
        }

        return null;
      });
      (mockVault.create as jest.Mock).mockResolvedValue(new TFile("test.md", "test"));

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

      const existingFile = new TFile("Projects/Existing Project.md", "Existing Project");
      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === "Projects") {
          return {};
        }

        if (path === "Projects/Existing Project.md") {
          return existingFile;
        }

        return null;
      });

      await expect(fileWriter.createProject(result, "test")).rejects.toThrow(
        "File Projects/Existing Project.md already exists"
      );
    });

    it("should handle missing additional next actions", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "Simple Project",
        nextAction: "First action",
        reasoning: "Test",
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Test",
      };

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === "Projects") {
          return {};
        }

        return null;
      });
      (mockVault.create as jest.Mock).mockResolvedValue({} as TFile);

      await fileWriter.createProject(result, "test");

      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toContain("## Next actions\n- [ ] First action");
      expect(content).not.toContain("Future next actions");
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

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === "Projects") {
          return {};
        }

        return null;
      });
      (mockVault.create as jest.Mock).mockResolvedValue({} as TFile);

      await fileWriter.createProject(result, "My Original Item");

      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toContain("# Description");
      expect(content).toContain("Original inbox item: My Original Item");
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

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === "Projects") {
          return {};
        }

        return null;
      });
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

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === "Projects") {
          return null;
        }

        return null;
      });
      (mockVault.create as jest.Mock).mockResolvedValue({} as TFile);

      await fileWriter.createProject(result, "test");

      expect(mockVault.createFolder).toHaveBeenCalledWith("Projects");
    });

    it("should add parent-project to frontmatter when creating sub-project with template", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "Sub Project",
        nextAction: "First step",
        reasoning: "Test",
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Test",
      };

      const templateFile = new TFile("Templates/Project.md", "Project template");
      const templateContent = `---
creation-date: <% tp.date.now("YYYY-MM-DD HH:mm") %>
priority: {{ priority }}
tags:
  - {{ sphere }}
status: live
---

# Description

{{ description }}

## Next actions
`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === "Projects") {
          return {};
        }

        if (path === "Templates/Project.md") {
          return templateFile;
        }

        return null;
      });
      (mockVault.read as jest.Mock).mockResolvedValue(templateContent);
      (mockVault.create as jest.Mock).mockResolvedValue({} as TFile);

      await fileWriter.createProject(result, "test", [], [], "[[Parent Project]]");

      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toContain('parent-project: "[[Parent Project]]"');
    });

    it("should add parent-project to frontmatter when creating sub-project with fallback", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "Sub Project",
        nextAction: "First step",
        reasoning: "Test",
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Test",
      };

      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === "Projects") {
          return {};
        }

        return null;
      });
      (mockVault.create as jest.Mock).mockResolvedValue({} as TFile);

      await fileWriter.createProject(result, "test", [], [], "[[Parent Project]]");

      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toContain('parent-project: "[[Parent Project]]"');
    });

    it("should create project with next actions with due date", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "Website redesign",
        nextAction: "Draft proposal outline",
        reasoning: "Multi-step project",
        nextActions: ["Draft proposal outline", "Review with stakeholders"],
        suggestedProjects: [],
        recommendedAction: "create-project",
        recommendedActionReasoning: "Multi-step project",
      };

      const mockFile = new TFile("Website-redesign.md", "Website redesign");
      (mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === "Projects") {
          return {};
        }

        return null;
      });
      (mockVault.create as jest.Mock).mockResolvedValue(mockFile);

      await fileWriter.createProject(
        result,
        "Website redesign",
        ["work"],
        [],
        undefined,
        [],
        "2025-11-05"
      );

      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toContain("- [ ] Draft proposal outline 📅 2025-11-05");
      expect(content).toContain("- [ ] Review with stakeholders 📅 2025-11-05");
    });
  });

  describe("addNextActionToProject", () => {
    const mockProject: FlowProject = {
      file: "project.md",
      title: "Test Project",
      tags: ["project/personal"],
      nextActions: ["Existing action"],
    };

    it("should add action to existing Next actions section", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      const existingContent = `---
tags: project/personal
---

# Test Project

## Next actions
- Existing action
`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addNextActionToProject(mockProject, "New action");

      expect(mockVault.modify).toHaveBeenCalled();
      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("- [ ] New action");
      expect(newContent).toContain("- Existing action");
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

      await fileWriter.addNextActionToProject(mockProject, "First action");

      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("## Next actions");
      expect(newContent).toContain("- [ ] First action");
    });

    it("should throw error if project file not found", async () => {
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      await expect(fileWriter.addNextActionToProject(mockProject, "New action")).rejects.toThrow(
        "Project file not found: project.md"
      );
    });

    it("should handle empty sections correctly", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      const existingContent = `## Next actions

`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addNextActionToProject(mockProject, "New action");

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
`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addNextActionToProject(mockProject, "New action");

      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("## Next actions");
      expect(newContent).toContain("- [ ] New action");
      expect(newContent).toContain("## Notes");
      expect(newContent).toContain("Some notes here");
    });

    it("should add action with due date to project", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      const existingContent = `---
tags: project/work
---

# Test Project

## Next actions

- [ ] Existing action
`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addNextActionToProject(
        mockProject,
        "Complete impact analysis",
        [],
        [],
        "2025-11-10"
      );

      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("- [ ] Complete impact analysis 📅 2025-11-10");
      expect(newContent).toContain("- [ ] Existing action");
    });
  });

  describe("updateProjectTags", () => {
    const mockProject: FlowProject = {
      file: "project.md",
      title: "Test Project",
      tags: ["project/personal"],
      nextActions: [],
    };

    it("should update project tags using processFrontMatter", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

      let frontmatterCallback: any;
      (mockFileManager.processFrontMatter as jest.Mock).mockImplementation((file, callback) => {
        frontmatterCallback = callback;
        const mockFrontmatter = { tags: ["project/personal", "urgent"] };
        callback(mockFrontmatter);
        return Promise.resolve();
      });

      await fileWriter.updateProjectTags(mockProject, ["project/work"]);

      expect(mockFileManager.processFrontMatter).toHaveBeenCalled();
    });

    it("should preserve existing project tags", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

      let resultTags: string[] = [];
      (mockFileManager.processFrontMatter as jest.Mock).mockImplementation((file, callback) => {
        const mockFrontmatter = {
          tags: ["project/personal", "project/health", "urgent"],
        };
        callback(mockFrontmatter);
        resultTags = mockFrontmatter.tags;
        return Promise.resolve();
      });

      await fileWriter.updateProjectTags(mockProject, ["important"]);

      expect(resultTags).toContain("project/personal");
      expect(resultTags).toContain("project/health");
    });

    it("should handle string tag format", async () => {
      const mockFile = new TFile("project.md", "Test Project");
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

      let resultTags: string[] = [];
      (mockFileManager.processFrontMatter as jest.Mock).mockImplementation((file, callback) => {
        const mockFrontmatter = { tags: "project/personal" };
        callback(mockFrontmatter);
        resultTags = mockFrontmatter.tags;
        return Promise.resolve();
      });

      await fileWriter.updateProjectTags(mockProject, ["urgent"]);

      expect(Array.isArray(resultTags)).toBe(true);
      expect(resultTags).toContain("project/personal");
    });

    it("should throw error if project file not found", async () => {
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      await expect(fileWriter.updateProjectTags(mockProject, ["new-tag"])).rejects.toThrow(
        "Project file not found: project.md"
      );
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

      await fileWriter.addToPersonDiscussNext(mockPerson, "New discussion topic");

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

      await fileWriter.addToPersonDiscussNext(mockPerson, "First discussion topic");

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

      await fileWriter.addToPersonDiscussNext(mockPerson, "New topic to discuss");

      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("## Discuss next");
      expect(newContent).toContain("- [ ] New topic to discuss");
      expect(newContent).toContain("Basic person note content.");
    });

    it("should throw error if person file not found", async () => {
      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      await expect(fileWriter.addToPersonDiscussNext(mockPerson, "Some topic")).rejects.toThrow(
        "Person file not found: people/John Doe.md"
      );
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

  describe("addToPersonNote", () => {
    const mockPerson: PersonNote = {
      file: "people/Sarah Johnson.md",
      title: "Sarah Johnson",
      tags: ["person"],
    };

    it("should add action with due date to person note", async () => {
      const existingContent = `# Sarah Johnson

## Actions

- [ ] Existing action
`;

      class MockTFile extends TFile {}
      const mockFile = new MockTFile();
      mockFile.path = "people/Sarah Johnson.md";

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      const item: EditableItem = {
        original: "Follow up with Sarah",
        isAIProcessed: true,
        selectedAction: "person",
        selectedPerson: mockPerson,
        selectedSpheres: ["work"],
        editedName: "Follow up about Q4 planning",
        dueDate: "2025-11-02",
      };

      await fileWriter.addToPersonNote(item);

      const expectedContent = expect.stringContaining(
        "- [ ] Follow up about Q4 planning 📅 2025-11-02"
      );
      expect(mockVault.modify).toHaveBeenCalledWith(mockFile, expectedContent);
    });
  });

  describe("mark as done functionality", () => {
    it("creates completed actions with completion date in next actions file", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "next-action",
        nextAction: "Call dentist",
        reasoning: "Need to schedule appointment",
        recommendedAction: "next-actions-file",
        recommendedActionReasoning: "Single action",
      };

      await fileWriter.addToNextActionsFile(["Call dentist"], ["personal"], [false], [true]);

      expect(mockVault.create).toHaveBeenCalled();
      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toMatch(/- \[x\] Call dentist ✅ \d{4}-\d{2}-\d{2}/);
    });

    it("creates completed actions with completion date in new projects", async () => {
      const result: GTDProcessingResult = {
        isActionable: true,
        category: "project",
        projectOutcome: "Website redesign complete",
        nextAction: "Review mockups",
        reasoning: "Multi-step project",
        recommendedAction: "create-project",
        recommendedActionReasoning: "Multiple steps needed",
      };

      const file = await fileWriter.createProject(
        result,
        "Redesign website",
        ["work"],
        [false],
        undefined,
        [true]
      );

      expect(mockVault.create).toHaveBeenCalled();
      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toMatch(/- \[x\] Review mockups ✅ \d{4}-\d{2}-\d{2}/);
    });

    it("creates completed actions when adding to existing project", async () => {
      const project: FlowProject = {
        file: "Projects/Test.md",
        title: "Test Project",
        tags: ["project/work"],
        nextActions: [],
      };

      const existingContent = `---
tags:
  - project/work
---

# Test Project

## Next actions

- [ ] Existing action
`;

      class MockTFile extends TFile {}
      const mockFile = new MockTFile();
      mockFile.path = "Projects/Test.md";

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addNextActionToProject(project, ["New completed action"], [false], [true]);

      expect(mockVault.modify).toHaveBeenCalled();
      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];
      expect(newContent).toMatch(/- \[x\] New completed action ✅ \d{4}-\d{2}-\d{2}/);
      expect(newContent).toContain("- [ ] Existing action");
    });

    it("prioritizes markAsDone over waitingFor", async () => {
      await fileWriter.addToNextActionsFile(
        ["Important task"],
        ["work"],
        [true], // waitingFor
        [true] // markAsDone - this should take precedence
      );

      expect(mockVault.create).toHaveBeenCalled();
      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toMatch(/- \[x\] Important task ✅ \d{4}-\d{2}-\d{2}/);
      expect(content).not.toContain("- [w]");
    });

    it("handles mixed completion states in multiple actions", async () => {
      await fileWriter.addToNextActionsFile(
        ["Done task", "Waiting task", "Regular task"],
        ["work"],
        [false, true, false], // waitingFor
        [true, false, false] // markAsDone
      );

      // Each action creates a separate call (3 total)
      expect(mockVault.create).toHaveBeenCalledTimes(3);

      // Check first call - done task
      const [, content1] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content1).toMatch(/- \[x\] Done task ✅ \d{4}-\d{2}-\d{2}/);

      // Check second call (actually calls modify since file now exists after first create)
      // But in the mock, we're always creating, so check the pattern
      const allCalls = (mockVault.create as jest.Mock).mock.calls;
      const allContent = allCalls.map((call: any[]) => call[1]).join("\n");

      expect(allContent).toMatch(/- \[x\] Done task ✅ \d{4}-\d{2}-\d{2}/);
      expect(allContent).toContain("- [w] Waiting task");
      expect(allContent).toContain("- [ ] Regular task");
    });
  });

  describe("due date support for next actions", () => {
    it("should write next action with due date to next actions file", async () => {
      await fileWriter.addToNextActionsFile(
        ["Call dentist for appointment"],
        ["personal"],
        [false],
        [false],
        "2025-11-15"
      );

      expect(mockVault.create).toHaveBeenCalled();
      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toBe("- [ ] Call dentist for appointment 📅 2025-11-15 #sphere/personal\n");
    });

    it("should write waiting-for action with due date to next actions file", async () => {
      await fileWriter.addToNextActionsFile(
        ["Wait for Sarah's feedback"],
        ["work"],
        [true],
        [false],
        "2025-11-01"
      );

      expect(mockVault.create).toHaveBeenCalled();
      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toBe("- [w] Wait for Sarah's feedback 📅 2025-11-01 #sphere/work\n");
    });

    it("should write next action without due date when dueDate is undefined", async () => {
      await fileWriter.addToNextActionsFile(
        ["Call dentist for appointment"],
        ["personal"],
        [false],
        [false],
        undefined
      );

      expect(mockVault.create).toHaveBeenCalled();
      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toBe("- [ ] Call dentist for appointment #sphere/personal\n");
    });

    it("should write completed action with due date showing both completion emoji and due date", async () => {
      await fileWriter.addToNextActionsFile(
        ["Call dentist for appointment"],
        ["personal"],
        [false],
        [true],
        "2025-11-15"
      );

      expect(mockVault.create).toHaveBeenCalled();
      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];
      expect(content).toMatch(
        /- \[x\] Call dentist for appointment ✅ \d{4}-\d{2}-\d{2} 📅 2025-11-15 #sphere\/personal\n/
      );
    });
  });

  describe("addToSomedayFile", () => {
    it("should add item without due date to someday file", async () => {
      await fileWriter.addToSomedayFile("Learn Spanish", ["personal"]);

      expect(mockVault.create).toHaveBeenCalled();
      const [filePath, content] = (mockVault.create as jest.Mock).mock.calls[0];

      expect(filePath).toBe("Someday.md");
      expect(content).toBe("- [ ] Learn Spanish #sphere/personal\n");
    });

    it("should add item with due date to someday file", async () => {
      await fileWriter.addToSomedayFile("Learn Spanish", ["personal"], "2026-01-12");

      expect(mockVault.create).toHaveBeenCalled();
      const [filePath, content] = (mockVault.create as jest.Mock).mock.calls[0];

      expect(filePath).toBe("Someday.md");
      expect(content).toBe("- [ ] Learn Spanish 📅 2026-01-12 #sphere/personal\n");
    });

    it("should add item with due date but no spheres", async () => {
      await fileWriter.addToSomedayFile("Write a book", [], "2025-06-01");

      expect(mockVault.create).toHaveBeenCalled();
      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];

      expect(content).toBe("- [ ] Write a book 📅 2025-06-01\n");
    });

    it("should add item without due date or spheres", async () => {
      await fileWriter.addToSomedayFile("Start a podcast");

      expect(mockVault.create).toHaveBeenCalled();
      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];

      expect(content).toBe("- [ ] Start a podcast\n");
    });

    it("should add item with due date and multiple spheres", async () => {
      await fileWriter.addToSomedayFile(
        "Organize team retreat",
        ["work", "personal"],
        "2026-03-15"
      );

      expect(mockVault.create).toHaveBeenCalled();
      const [, content] = (mockVault.create as jest.Mock).mock.calls[0];

      expect(content).toBe(
        "- [ ] Organize team retreat 📅 2026-03-15 #sphere/work #sphere/personal\n"
      );
    });

    it("should append to existing someday file", async () => {
      const mockFile = new TFile();
      const existingContent = `- [ ] Learn French #sphere/personal
- [ ] Write book #sphere/personal
`;

      (mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockVault.read as jest.Mock).mockResolvedValue(existingContent);

      await fileWriter.addToSomedayFile("Learn Spanish", ["personal"], "2026-01-12");

      expect(mockVault.modify).toHaveBeenCalled();
      const [, newContent] = (mockVault.modify as jest.Mock).mock.calls[0];

      expect(newContent).toContain("- [ ] Learn French #sphere/personal");
      expect(newContent).toContain("- [ ] Write book #sphere/personal");
      expect(newContent).toContain("- [ ] Learn Spanish 📅 2026-01-12 #sphere/personal");
    });

    it("should add multiple items to someday file", async () => {
      await fileWriter.addToSomedayFile(
        ["Learn Spanish", "Write a book", "Start a podcast"],
        ["personal"],
        "2026-01-12"
      );

      expect(mockVault.create).toHaveBeenCalledTimes(3);

      const allCalls = (mockVault.create as jest.Mock).mock.calls;
      expect(allCalls[0][1]).toBe("- [ ] Learn Spanish 📅 2026-01-12 #sphere/personal\n");
      expect(allCalls[1][1]).toBe("- [ ] Write a book 📅 2026-01-12 #sphere/personal\n");
      expect(allCalls[2][1]).toBe("- [ ] Start a podcast 📅 2026-01-12 #sphere/personal\n");
    });

    it("should add multiple items without due date", async () => {
      await fileWriter.addToSomedayFile(["Learn Spanish", "Write a book"], ["personal"]);

      expect(mockVault.create).toHaveBeenCalledTimes(2);

      const allCalls = (mockVault.create as jest.Mock).mock.calls;
      expect(allCalls[0][1]).toBe("- [ ] Learn Spanish #sphere/personal\n");
      expect(allCalls[1][1]).toBe("- [ ] Write a book #sphere/personal\n");
    });
  });
});
