# CLI Tool Support - Task 4: Implement Tool Execution Logic

**Goal:** Fill in the TODO stubs in ToolExecutor with real file operations

**Architecture:** Use FileWriter methods and direct vault operations. Add hotlist helper logic extracted from hotlist-view.

**Tech Stack:** Obsidian vault API, FileWriter, frontmatter processing

---

### Step 1: Write failing tests for real tool execution

**File:** `tests/cli-tools-execution.test.ts`

```typescript
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
      hotlist: [],
    } as any;

    executor = new ToolExecutor(mockApp, mockFileWriter, mockSettings);
  });

  describe("moveToHotlist", () => {
    it("should add action to hotlist from project file", async () => {
      const mockFile = {
        path: "Projects/Test.md",
        basename: "Test",
      } as TFile;

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
        name: "move_to_hotlist",
        input: {
          project_path: "Projects/Test.md",
          action_text: "First action",
        },
      };

      const result = await executor.executeTool(toolCall);

      expect(result.is_error).not.toBe(true);
      expect(result.content).toContain("Added");
      expect(mockSettings.hotlist).toHaveLength(1);
      expect(mockSettings.hotlist[0].text).toBe("First action");
      expect(mockSettings.hotlist[0].file).toBe("Projects/Test.md");
      expect(mockSettings.hotlist[0].sphere).toBe("work");
    });

    it("should extract sphere from tags", async () => {
      const mockFile = { path: "Projects/Personal.md" } as TFile;
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockApp.vault.read as jest.Mock).mockResolvedValue("## Next actions\n- [ ] Test action");
      (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
        frontmatter: {
          tags: ["project/personal", "other-tag"],
        },
      });

      const toolCall: ToolCall = {
        id: "call_1",
        name: "move_to_hotlist",
        input: {
          project_path: "Projects/Personal.md",
          action_text: "Test action",
        },
      };

      const result = await executor.executeTool(toolCall);

      expect(mockSettings.hotlist[0].sphere).toBe("personal");
    });

    it("should default to 'personal' sphere if no tags", async () => {
      const mockFile = { path: "Projects/NoTags.md" } as TFile;
      (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (mockApp.vault.read as jest.Mock).mockResolvedValue("## Next actions\n- [ ] Action");
      (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({});

      const toolCall: ToolCall = {
        id: "call_1",
        name: "move_to_hotlist",
        input: {
          project_path: "Projects/NoTags.md",
          action_text: "Action",
        },
      };

      await executor.executeTool(toolCall);

      expect(mockSettings.hotlist[0].sphere).toBe("personal");
    });
  });

  describe("updateNextAction", () => {
    it("should find and replace action text", async () => {
      const mockFile = { path: "Projects/Test.md" } as TFile;
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
      const mockFile = { path: "Projects/Test.md" } as TFile;
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
  });

  describe("addNextActionToProject", () => {
    it("should call FileWriter.addNextActionToProject", async () => {
      const mockFile = { path: "Projects/Test.md", basename: "Test" } as TFile;
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
      const mockFile = { path: "Projects/Test.md", basename: "Test" } as TFile;
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
      const mockFile = { path: "Projects/Test.md" } as TFile;
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
```

### Step 2: Run test to verify it fails

Run: `npm test -- cli-tools-execution.test.ts`

Expected: FAIL - tests fail because implementations are stubs

### Step 3: Implement moveToHotlist

**File:** `src/cli-tools.ts`

Replace the `moveToHotlist` method:

```typescript
  private async moveToHotlist(toolCall: ToolCall): Promise<ToolResult> {
    const { project_path, action_text } = toolCall.input as {
      project_path: string;
      action_text: string;
    };

    // Validate file exists
    const file = this.app.vault.getAbstractFileByPath(project_path);
    if (!(file instanceof TFile)) {
      throw new Error(`Project file not found: ${project_path}`);
    }

    // Read file to find action and its line number
    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);

    let lineNumber: number | null = null;
    let lineContent: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match uncompleted action checkboxes with the action text
      if (line.match(/^- \[ \]/) && line.includes(action_text)) {
        lineNumber = i + 1; // 1-indexed
        lineContent = line;
        break;
      }
    }

    if (lineNumber === null || lineContent === null) {
      throw new Error(`Action "${action_text}" not found in ${project_path}`);
    }

    // Extract sphere from project tags
    const cache = this.app.metadataCache.getFileCache(file);
    const tags = cache?.frontmatter?.tags || [];
    const tagsArray = Array.isArray(tags) ? tags : [tags];
    const sphereTag = tagsArray.find((tag: string) => tag.startsWith("project/"));
    const sphere = sphereTag ? sphereTag.replace("project/", "") : "personal";

    // Add to hotlist
    this.settings.hotlist.push({
      file: project_path,
      lineNumber,
      lineContent,
      text: action_text,
      sphere,
      isGeneral: false,
      addedAt: Date.now(),
    });

    return {
      tool_use_id: toolCall.id,
      content: `✓ Added "${action_text}" to hotlist`,
    };
  }
```

### Step 4: Implement updateNextAction

**File:** `src/cli-tools.ts`

Replace the `updateNextAction` method:

```typescript
  private async updateNextAction(toolCall: ToolCall): Promise<ToolResult> {
    const { project_path, old_action, new_action } = toolCall.input as {
      project_path: string;
      old_action: string;
      new_action: string;
    };

    const file = this.app.vault.getAbstractFileByPath(project_path);
    if (!(file instanceof TFile)) {
      throw new Error(`Project file not found: ${project_path}`);
    }

    let content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);

    let found = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match checkbox lines containing old action text
      if (line.match(/^- \[(?: |w)\]/) && line.includes(old_action)) {
        // Replace old action with new action, preserving checkbox and tags
        lines[i] = line.replace(old_action, new_action);
        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error(`Action "${old_action}" not found in ${project_path}`);
    }

    content = lines.join("\n");
    await this.app.vault.modify(file, content);

    return {
      tool_use_id: toolCall.id,
      content: `✓ Updated action in ${project_path}`,
    };
  }
```

### Step 5: Implement addNextActionToProject

**File:** `src/cli-tools.ts`

Replace the `addNextActionToProject` method:

```typescript
  private async addNextActionToProject(toolCall: ToolCall): Promise<ToolResult> {
    const { project_path, action_text, is_waiting } = toolCall.input as {
      project_path: string;
      action_text: string;
      is_waiting?: boolean;
    };

    const file = this.app.vault.getAbstractFileByPath(project_path);
    if (!(file instanceof TFile)) {
      throw new Error(`Project file not found: ${project_path}`);
    }

    // Construct minimal FlowProject object for FileWriter
    const project: FlowProject = {
      file: project_path,
      title: file.basename,
      description: "",
      priority: 2,
      tags: [],
      status: "live",
      nextActions: [],
      waitingFor: [],
    };

    await this.fileWriter.addNextActionToProject(
      project,
      action_text,
      [is_waiting || false]
    );

    return {
      tool_use_id: toolCall.id,
      content: `✓ Added action to ${project_path}`,
    };
  }
```

### Step 6: Implement updateProjectStatus

**File:** `src/cli-tools.ts`

Replace the `updateProjectStatus` method:

```typescript
  private async updateProjectStatus(toolCall: ToolCall): Promise<ToolResult> {
    const { project_path, new_status } = toolCall.input as {
      project_path: string;
      new_status: string;
    };

    const file = this.app.vault.getAbstractFileByPath(project_path);
    if (!(file instanceof TFile)) {
      throw new Error(`Project file not found: ${project_path}`);
    }

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.status = new_status;
    });

    return {
      tool_use_id: toolCall.id,
      content: `✓ Updated ${project_path} status to ${new_status}`,
    };
  }
```

### Step 7: Add HotlistItem import

**File:** `src/cli-tools.ts`

Update the imports at the top:

```typescript
import { PluginSettings, FlowProject, HotlistItem } from "./types";
```

### Step 8: Run tests to verify they pass

Run: `npm test -- cli-tools-execution.test.ts`

Expected: PASS - all execution tests pass

### Step 9: Run original cli-tools tests

Run: `npm test -- cli-tools.test.ts`

Expected: PASS - stub tests still pass

### Step 10: Run full test suite

Run: `npm test`

Expected: PASS - no regressions

### Step 11: Commit

```bash
git add src/cli-tools.ts tests/cli-tools-execution.test.ts
git commit -m "feat: implement tool execution logic for all 4 CLI tools"
```

---

## Acceptance Criteria

- [x] `moveToHotlist` finds action line, extracts sphere, adds to hotlist
- [x] `updateNextAction` finds and replaces action text in file
- [x] `addNextActionToProject` uses FileWriter to add action
- [x] `updateProjectStatus` uses processFrontMatter to update status
- [x] All operations handle file-not-found errors
- [x] All operations return success messages
- [x] Test coverage ≥80%
