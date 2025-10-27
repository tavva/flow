import { ToolExecutor } from "../src/cli-tools";
import { ToolCall } from "../src/language-model";
import { App, TFile } from "obsidian";
import { FileWriter } from "../src/file-writer";
import { PluginSettings } from "../src/types";

describe("ToolExecutor - Real Execution", () => {
  let mockApp: App;
  let mockFileWriter: FileWriter;
  let mockSettings: PluginSettings;
  let executor: ToolExecutor;

  beforeEach(() => {
    mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
        modify: jest.fn(),
      },
      fileManager: {
        processFrontMatter: jest.fn(),
      },
      metadataCache: {
        getFileCache: jest.fn(),
      },
    } as any;

    mockFileWriter = {
      addNextActionToProject: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockSettings = {
      focus: [],
    } as any;

    executor = new ToolExecutor(mockApp, mockFileWriter, mockSettings);
  });

  describe("moveToFocus", () => {
    it("should add action to focus from project file", async () => {
      const mockFile = new TFile();
      mockFile.path = "Projects/Test.md";
      mockFile.basename = "Test";

      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockApp.vault.read as jest.Mock).mockResolvedValue(`---
tags:
  - project/work
---

## Next actions
- [ ] First action
- [ ] Second action
`);

      (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
        frontmatter: {
          tags: ["project/work"],
        },
      });

      const toolCall: ToolCall = {
        id: "call_1",
        name: "move_to_focus",
        input: {
          project_path: "Projects/Test.md",
          action_text: "First action",
        },
      };

      const result = await executor.executeTool(toolCall);

      expect(result.is_error).not.toBe(true);
      expect(result.content).toContain("Added");
      expect(mockSettings.focus).toHaveLength(1);
      expect(mockSettings.focus[0].text).toBe("First action");
      expect(mockSettings.focus[0].file).toBe("Projects/Test.md");
      expect(mockSettings.focus[0].sphere).toBe("work");
    });

    it("should extract sphere from tags", async () => {
      const mockFile = new TFile();
      mockFile.path = "Projects/Personal.md";
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockApp.vault.read as jest.Mock).mockResolvedValue("## Next actions\n- [ ] Test action");
      (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
        frontmatter: {
          tags: ["project/personal", "other-tag"],
        },
      });

      const toolCall: ToolCall = {
        id: "call_1",
        name: "move_to_focus",
        input: {
          project_path: "Projects/Personal.md",
          action_text: "Test action",
        },
      };

      const result = await executor.executeTool(toolCall);

      expect(mockSettings.focus[0].sphere).toBe("personal");
    });

    it("should default to 'personal' sphere if no tags", async () => {
      const mockFile = new TFile();
      mockFile.path = "Projects/NoTags.md";
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockApp.vault.read as jest.Mock).mockResolvedValue("## Next actions\n- [ ] Action");
      (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({});

      const toolCall: ToolCall = {
        id: "call_1",
        name: "move_to_focus",
        input: {
          project_path: "Projects/NoTags.md",
          action_text: "Action",
        },
      };

      await executor.executeTool(toolCall);

      expect(mockSettings.focus[0].sphere).toBe("personal");
    });

    it("should reject duplicate focus additions", async () => {
      const mockFile = new TFile();
      mockFile.path = "Projects/Test.md";
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockApp.vault.read as jest.Mock).mockResolvedValue("## Next actions\n- [ ] Test action");
      (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
        frontmatter: { tags: ["project/work"] },
      });

      // Add action first time
      const toolCall: ToolCall = {
        id: "call_1",
        name: "move_to_focus",
        input: {
          project_path: "Projects/Test.md",
          action_text: "Test action",
        },
      };

      await executor.executeTool(toolCall);
      expect(mockSettings.focus).toHaveLength(1);

      // Try to add same action again
      const result = await executor.executeTool(toolCall);
      expect(result.is_error).toBe(true);
      expect(result.content).toContain("already in focus");
      expect(mockSettings.focus).toHaveLength(1); // Still only one
    });
  });

  describe("updateNextAction", () => {
    it("should find and replace action text", async () => {
      const mockFile = new TFile();
      mockFile.path = "Projects/Test.md";
      const originalContent = `---
tags: [project/work]
---

## Next actions
- [ ] Old action text
- [ ] Another action
`;

      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockApp.vault.read as jest.Mock).mockResolvedValue(originalContent);

      const toolCall: ToolCall = {
        id: "call_1",
        name: "update_next_action",
        input: {
          project_path: "Projects/Test.md",
          old_action: "Old action text",
          new_action: "New improved action text",
        },
      };

      const result = await executor.executeTool(toolCall);

      expect(result.is_error).not.toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining("- [ ] New improved action text")
      );
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.not.stringContaining("Old action text")
      );
    });

    it("should handle action not found gracefully", async () => {
      const mockFile = new TFile();
      mockFile.path = "Projects/Test.md";
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockApp.vault.read as jest.Mock).mockResolvedValue(
        "## Next actions\n- [ ] Different action"
      );

      const toolCall: ToolCall = {
        id: "call_1",
        name: "update_next_action",
        input: {
          project_path: "Projects/Test.md",
          old_action: "Nonexistent action",
          new_action: "New action",
        },
      };

      const result = await executor.executeTool(toolCall);

      expect(result.is_error).toBe(true);
      expect(result.content).toContain("not found");
    });

    it("should use exact match to avoid partial matches", async () => {
      const mockFile = new TFile();
      mockFile.path = "Projects/Test.md";
      const originalContent = `## Next actions
- [ ] Call client
- [ ] Call client about project
`;

      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockApp.vault.read as jest.Mock).mockResolvedValue(originalContent);

      const toolCall: ToolCall = {
        id: "call_1",
        name: "update_next_action",
        input: {
          project_path: "Projects/Test.md",
          old_action: "Call client",
          new_action: "Call specific client",
        },
      };

      const result = await executor.executeTool(toolCall);

      expect(result.is_error).not.toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining("- [ ] Call specific client\n- [ ] Call client about project")
      );
    });
  });

  describe("addNextActionToProject", () => {
    it("should call FileWriter.addNextActionToProject", async () => {
      const mockFile = new TFile();
      mockFile.path = "Projects/Test.md";
      mockFile.basename = "Test";
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

      const toolCall: ToolCall = {
        id: "call_1",
        name: "add_next_action_to_project",
        input: {
          project_path: "Projects/Test.md",
          action_text: "New action to add",
          is_waiting: false,
        },
      };

      const result = await executor.executeTool(toolCall);

      expect(result.is_error).not.toBe(true);
      expect(mockFileWriter.addNextActionToProject).toHaveBeenCalledWith(
        expect.objectContaining({ file: "Projects/Test.md" }),
        "New action to add",
        [false]
      );
    });

    it("should handle waiting-for actions", async () => {
      const mockFile = new TFile();
      mockFile.path = "Projects/Test.md";
      mockFile.basename = "Test";
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

      const toolCall: ToolCall = {
        id: "call_1",
        name: "add_next_action_to_project",
        input: {
          project_path: "Projects/Test.md",
          action_text: "Waiting action",
          is_waiting: true,
        },
      };

      await executor.executeTool(toolCall);

      expect(mockFileWriter.addNextActionToProject).toHaveBeenCalledWith(
        expect.anything(),
        "Waiting action",
        [true]
      );
    });
  });

  describe("updateProjectStatus", () => {
    it("should update frontmatter status field", async () => {
      const mockFile = new TFile();
      mockFile.path = "Projects/Test.md";
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

      let frontmatterModifier: ((fm: any) => void) | null = null;
      (mockApp.fileManager.processFrontMatter as jest.Mock).mockImplementation(
        (file: TFile, callback: (fm: any) => void) => {
          frontmatterModifier = callback;
          const fm = { status: "live" };
          callback(fm);
          return Promise.resolve();
        }
      );

      const toolCall: ToolCall = {
        id: "call_1",
        name: "update_project_status",
        input: {
          project_path: "Projects/Test.md",
          new_status: "archived",
        },
      };

      const result = await executor.executeTool(toolCall);

      expect(result.is_error).not.toBe(true);
      expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalledWith(
        mockFile,
        expect.any(Function)
      );

      // Verify the modifier was called and would update status
      const testFm = { status: "live" };
      frontmatterModifier!(testFm);
      expect(testFm.status).toBe("archived");
    });
  });
});
