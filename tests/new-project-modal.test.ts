// ABOUTME: Tests for the NewProjectModal class
// ABOUTME: Verifies project creation flow and validation logic

import { App } from "obsidian";
import { NewProjectModal } from "../src/new-project-modal";
import { DEFAULT_SETTINGS } from "../src/types";
import { generateDeterministicFakeApiKey } from "./test-utils";

// Mock the dependencies
jest.mock("../src/flow-scanner", () => ({
  FlowProjectScanner: jest.fn().mockImplementation(() => ({
    scanProjects: jest.fn().mockResolvedValue([
      {
        file: "Projects/Existing Project.md",
        title: "Existing Project",
        tags: ["project/work"],
        status: "live",
        priority: 2,
        nextActions: ["Do something"],
        mtime: Date.now(),
      },
    ]),
  })),
}));

jest.mock("../src/file-writer", () => ({
  FileWriter: jest.fn().mockImplementation(() => ({
    createProject: jest.fn().mockResolvedValue({
      path: "Projects/New Project.md",
      name: "New Project.md",
    }),
  })),
}));

jest.mock("../src/focus-persistence", () => ({
  loadFocusItems: jest.fn().mockResolvedValue([]),
  saveFocusItems: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/action-line-finder", () => ({
  ActionLineFinder: jest.fn().mockImplementation(() => ({
    findActionLine: jest.fn().mockResolvedValue({
      found: true,
      lineNumber: 10,
      lineContent: "- [ ] First action",
    }),
  })),
}));

describe("NewProjectModal", () => {
  let mockApp: App;
  let modal: NewProjectModal;
  let mockSaveSettings: jest.Mock;

  beforeEach(() => {
    mockApp = new App();
    // Mock workspace.getLeaf for the openFile call after creation
    (mockApp.workspace.getLeaf as jest.Mock).mockReturnValue({
      openFile: jest.fn().mockResolvedValue(undefined),
    });

    mockSaveSettings = jest.fn().mockResolvedValue(undefined);

    const settings = {
      ...DEFAULT_SETTINGS,
      anthropicApiKey: generateDeterministicFakeApiKey("test-modal"),
      spheres: ["personal", "work"],
      defaultPriority: 2,
    };

    modal = new NewProjectModal(mockApp, settings, mockSaveSettings);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validation", () => {
    it("should require project title", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      data.title = "";
      data.nextAction = "Do something";
      data.spheres = ["work"];

      await (modal as any).createProject();

      // Should show error, not call FileWriter
      const { FileWriter } = require("../src/file-writer");
      const writerInstance = FileWriter.mock.results[0].value;
      expect(writerInstance.createProject).not.toHaveBeenCalled();
    });

    it("should require next action", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      data.title = "Test Project";
      data.nextAction = "";
      data.spheres = ["work"];

      await (modal as any).createProject();

      const { FileWriter } = require("../src/file-writer");
      const writerInstance = FileWriter.mock.results[0].value;
      expect(writerInstance.createProject).not.toHaveBeenCalled();
    });

    it("should require at least one sphere", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      data.title = "Test Project";
      data.nextAction = "Do something";
      data.spheres = [];

      await (modal as any).createProject();

      const { FileWriter } = require("../src/file-writer");
      const writerInstance = FileWriter.mock.results[0].value;
      expect(writerInstance.createProject).not.toHaveBeenCalled();
    });

    it("should require parent project when creating sub-project", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      data.title = "Sub Project";
      data.nextAction = "Do something";
      data.spheres = ["work"];
      data.isSubProject = true;
      data.parentProject = null;

      await (modal as any).createProject();

      const { FileWriter } = require("../src/file-writer");
      const writerInstance = FileWriter.mock.results[0].value;
      expect(writerInstance.createProject).not.toHaveBeenCalled();
    });
  });

  describe("project creation", () => {
    it("should create project with correct data", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      data.title = "Test Project";
      data.nextAction = "First action";
      data.description = "Project description";
      data.spheres = ["work"];
      data.priority = 1;

      await (modal as any).createProject();

      const { FileWriter } = require("../src/file-writer");
      const writerInstance = FileWriter.mock.results[0].value;

      expect(writerInstance.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          projectOutcome: "Test Project",
          nextAction: "First action",
          reasoning: "User created project directly",
          description: "Project description",
          projectPriority: 1,
        }),
        "Test Project",
        ["work"],
        [],
        undefined,
        [],
        undefined,
        undefined
      );
    });

    it("should include parent project link when creating sub-project", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      data.title = "Sub Project";
      data.nextAction = "First action";
      data.spheres = ["work"];
      data.isSubProject = true;
      data.parentProject = {
        file: "Projects/Parent.md",
        title: "Parent Project",
      };

      await (modal as any).createProject();

      const { FileWriter } = require("../src/file-writer");
      const writerInstance = FileWriter.mock.results[0].value;

      expect(writerInstance.createProject).toHaveBeenCalledWith(
        expect.anything(),
        "Sub Project",
        ["work"],
        [],
        "[[Parent Project]]",
        [],
        undefined,
        undefined
      );
    });

    it("should pass empty description when description is not provided", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      data.title = "Test Project";
      data.nextAction = "First action";
      data.description = "";
      data.spheres = ["work"];

      await (modal as any).createProject();

      const { FileWriter } = require("../src/file-writer");
      const writerInstance = FileWriter.mock.results[0].value;

      expect(writerInstance.createProject).toHaveBeenCalled();
      const firstArg = writerInstance.createProject.mock.calls[0][0];
      expect(firstArg.reasoning).toBe("User created project directly");
      expect(firstArg.description).toBe("");
    });

    it("should add action to focus when option is enabled", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      data.title = "Test Project";
      data.nextAction = "First action";
      data.spheres = ["work"];
      data.addToFocus = true;

      await (modal as any).createProject();

      const { saveFocusItems } = require("../src/focus-persistence");
      expect(saveFocusItems).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({
            text: "First action",
            sphere: "work",
          }),
        ])
      );
    });

    it("should not add to focus when option is disabled", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      data.title = "Test Project";
      data.nextAction = "First action";
      data.spheres = ["work"];
      data.addToFocus = false;

      await (modal as any).createProject();

      const { saveFocusItems } = require("../src/focus-persistence");
      expect(saveFocusItems).not.toHaveBeenCalled();
    });
  });

  describe("defaults", () => {
    it("should use default priority from settings", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      expect(data.priority).toBe(2); // Default from settings
    });

    it("should initialize with empty spheres", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      expect(data.spheres).toEqual([]);
    });

    it("should not be sub-project by default", async () => {
      await modal.onOpen();

      const data = (modal as any).data;
      expect(data.isSubProject).toBe(false);
      expect(data.parentProject).toBeNull();
    });
  });
});
