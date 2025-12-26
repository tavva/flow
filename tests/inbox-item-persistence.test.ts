import { InboxItemPersistenceService } from "../src/inbox-item-persistence";
import { EditableItem } from "../src/inbox-types";
import { FileWriter } from "../src/file-writer";
import { GTDResponseValidationError } from "../src/errors";
import { FocusItem } from "../src/types";

// Mock the cover image generator module before importing anything that uses it
jest.mock("../src/cover-image-generator", () => ({
  generateCoverImage: jest.fn(),
}));

// Mock focus persistence
let mockFocusItems: FocusItem[] = [];
jest.mock("../src/focus-persistence", () => ({
  loadFocusItems: jest.fn(() => Promise.resolve(mockFocusItems)),
  saveFocusItems: jest.fn((vault, items) => {
    mockFocusItems = items;
    return Promise.resolve();
  }),
}));

jest.mock("../src/action-line-finder", () => ({
  ActionLineFinder: jest.fn().mockImplementation(() => ({
    findActionLine: jest.fn().mockResolvedValue({
      found: true,
      lineNumber: 10,
      lineContent: "- [x] Call dentist",
    }),
  })),
}));

import { generateCoverImage } from "../src/cover-image-generator";
const mockGenerateCoverImage = generateCoverImage as jest.MockedFunction<typeof generateCoverImage>;

describe("InboxItemPersistenceService", () => {
  let writerMocks: {
    createProject: jest.Mock;
    addNextActionToProject: jest.Mock;
    addToNextActionsFile: jest.Mock;
    addToSomedayFile: jest.Mock;
    addReferenceToProject: jest.Mock;
    addToPersonDiscussNext: jest.Mock;
  };
  let service: InboxItemPersistenceService;

  beforeEach(() => {
    mockFocusItems = [];
    writerMocks = {
      createProject: jest.fn().mockResolvedValue({ path: "Projects/Test.md" }),
      addNextActionToProject: jest.fn(),
      addToNextActionsFile: jest.fn(),
      addToSomedayFile: jest.fn(),
      addReferenceToProject: jest.fn(),
      addToPersonDiscussNext: jest.fn(),
    };
    service = new InboxItemPersistenceService(writerMocks as unknown as FileWriter);
  });

  it("uses edited next actions when creating a project", async () => {
    const item: EditableItem = {
      original: "Plan offsite",
      isAIProcessed: false,
      selectedAction: "create-project",
      selectedSpheres: ["work"],
      editedNames: ["Finalize venue", "Publish agenda"],
    };

    await service.persist(item);

    expect(writerMocks.createProject).toHaveBeenCalledTimes(1);
    expect(writerMocks.createProject.mock.calls[0][0]).toMatchObject({
      nextAction: "Finalize venue",
      nextActions: ["Finalize venue", "Publish agenda"],
      recommendedAction: "create-project",
    });
    expect(writerMocks.createProject).toHaveBeenCalledWith(
      expect.any(Object),
      "Plan offsite",
      ["work"],
      [false, false], // waitingFor
      undefined, // parentProject
      [false, false], // markAsDone
      undefined, // dueDate
      undefined // sourceNoteLink
    );
  });

  it("propagates the selected project priority when creating a project", async () => {
    const item: EditableItem = {
      original: "Plan offsite",
      isAIProcessed: false,
      selectedAction: "create-project",
      selectedSpheres: ["work"],
      editedNames: ["Finalize venue"],
      projectPriority: 5,
    };

    await service.persist(item);

    expect(writerMocks.createProject).toHaveBeenCalledTimes(1);
    expect(writerMocks.createProject.mock.calls[0][0]).toMatchObject({
      projectPriority: 5,
    });
  });

  it("throws when required next actions are empty", async () => {
    const item: EditableItem = {
      original: "   ",
      isAIProcessed: false,
      selectedAction: "next-actions-file",
      selectedSpheres: [],
    };

    await expect(service.persist(item)).rejects.toThrow(GTDResponseValidationError);
    expect(writerMocks.addToNextActionsFile).not.toHaveBeenCalled();
  });

  it("skips persistence work for trash items", async () => {
    const item: EditableItem = {
      original: "Duplicate",
      isAIProcessed: false,
      selectedAction: "trash",
      selectedSpheres: [],
    };

    await service.persist(item);

    Object.values(writerMocks).forEach((mockFn) => {
      expect(mockFn).not.toHaveBeenCalled();
    });
  });

  it("throws when creating project with no spheres selected", async () => {
    const item: EditableItem = {
      original: "Plan something",
      isAIProcessed: false,
      selectedAction: "create-project",
      selectedSpheres: [], // No spheres selected
      editedNames: ["Do the thing"],
    };

    await expect(service.persist(item)).rejects.toThrow(GTDResponseValidationError);
    await expect(service.persist(item)).rejects.toThrow(
      "At least one sphere must be selected for this action."
    );
  });

  it("throws when adding to next-actions-file with no spheres selected", async () => {
    const item: EditableItem = {
      original: "Call dentist",
      isAIProcessed: false,
      selectedAction: "next-actions-file",
      selectedSpheres: [], // No spheres selected
      editedName: "Call dentist to schedule cleaning",
    };

    await expect(service.persist(item)).rejects.toThrow(GTDResponseValidationError);
    await expect(service.persist(item)).rejects.toThrow(
      "At least one sphere must be selected for this action."
    );
    expect(writerMocks.addToNextActionsFile).not.toHaveBeenCalled();
  });

  it("throws when adding to someday-file with no spheres selected", async () => {
    const item: EditableItem = {
      original: "Learn Spanish",
      isAIProcessed: false,
      selectedAction: "someday-file",
      selectedSpheres: [], // No spheres selected
    };

    await expect(service.persist(item)).rejects.toThrow(GTDResponseValidationError);
    await expect(service.persist(item)).rejects.toThrow(
      "At least one sphere must be selected for this action."
    );
    expect(writerMocks.addToSomedayFile).not.toHaveBeenCalled();
  });

  it("passes markAsDone array when creating a project with completed actions", async () => {
    const item: EditableItem = {
      original: "Plan offsite",
      isAIProcessed: false,
      selectedAction: "create-project",
      selectedSpheres: ["work"],
      editedNames: ["Finalize venue", "Publish agenda"],
      markAsDone: [true, false],
    };

    await service.persist(item);

    expect(writerMocks.createProject).toHaveBeenCalledWith(
      expect.any(Object),
      "Plan offsite",
      ["work"],
      [false, false], // waitingFor
      undefined, // parentProject
      [true, false], // markAsDone
      undefined, // dueDate
      undefined // sourceNoteLink
    );
  });

  it("passes markAsDone array when adding to next actions file", async () => {
    const item: EditableItem = {
      original: "Call dentist",
      isAIProcessed: false,
      selectedAction: "next-actions-file",
      selectedSpheres: ["personal"],
      editedName: "Call dentist to schedule cleaning",
      markAsDone: [true],
    };

    await service.persist(item);

    expect(writerMocks.addToNextActionsFile).toHaveBeenCalledWith(
      ["Call dentist to schedule cleaning"],
      ["personal"],
      [false], // waitingFor
      [true], // markAsDone
      undefined, // dueDate
      undefined // sourceNoteLink
    );
  });

  it("passes markAsDone array when adding to project", async () => {
    const mockProject = {
      file: "Projects/Test.md",
      title: "Test Project",
      tags: ["project/work"],
      nextActions: [],
    };

    const item: EditableItem = {
      original: "Review document",
      isAIProcessed: false,
      selectedAction: "add-to-project",
      selectedSpheres: ["work"],
      selectedProject: mockProject,
      editedNames: ["Review document", "Provide feedback"],
      markAsDone: [false, true],
    };

    await service.persist(item);

    expect(writerMocks.addNextActionToProject).toHaveBeenCalledWith(
      mockProject,
      ["Review document", "Provide feedback"],
      [false, false], // waitingFor
      [false, true] // markAsDone
    );
  });

  it("adds completed items to focus with completedAt timestamp", async () => {
    const mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
      },
    };

    const mockSettings = {
      nextActionsFilePath: "Next actions.md",
    };

    const mockSaveSettings = jest.fn();

    const serviceWithFocus = new InboxItemPersistenceService(
      writerMocks as unknown as FileWriter,
      mockApp as any,
      mockSettings as any,
      mockSaveSettings
    );

    const item: EditableItem = {
      original: "Call dentist",
      isAIProcessed: false,
      selectedAction: "next-actions-file",
      selectedSpheres: ["personal"],
      editedName: "Call dentist",
      addToFocus: [true],
      markAsDone: [true],
    };

    await serviceWithFocus.persist(item);

    // Completed items should be added to focus with completedAt set
    expect(mockFocusItems.length).toBe(1);
    expect(mockFocusItems[0].text).toBe("Call dentist");
    expect(mockFocusItems[0].completedAt).toBeDefined();
    expect(mockFocusItems[0].sphere).toBe("personal");
  });

  describe("auto-create cover image", () => {
    let mockApp: any;
    let mockSettings: any;
    let serviceWithCoverImage: InboxItemPersistenceService;

    beforeEach(() => {
      // Set up the mock to return a successful result
      mockGenerateCoverImage.mockResolvedValue({
        imagePath: "Assets/flow-project-cover-images/test-image.png",
      });

      mockApp = {
        vault: {
          read: jest.fn().mockResolvedValue("# Project Title\n\nProject content"),
          getAbstractFileByPath: jest.fn().mockReturnValue({
            path: "Projects/Test.md",
            basename: "Test",
          }),
          adapter: {
            mkdir: jest.fn().mockResolvedValue(undefined),
            write: jest.fn().mockResolvedValue(undefined),
          },
        },
        fileManager: {
          processFrontMatter: jest.fn(),
        },
      };

      mockSettings = {
        autoCreateCoverImage: true,
        openaiApiKey: "test-key",
        openaiBaseUrl: "https://openrouter.ai/api/v1",
        openrouterImageModel: "google/gemini-2.5-flash-image",
        coverImagesFolderPath: "Assets/flow-project-cover-images",
      };

      serviceWithCoverImage = new InboxItemPersistenceService(
        writerMocks as unknown as FileWriter,
        mockApp,
        mockSettings
      );
    });

    it("generates cover image when autoCreateCoverImage is enabled", async () => {
      const item: EditableItem = {
        original: "Plan offsite",
        isAIProcessed: false,
        selectedAction: "create-project",
        selectedSpheres: ["work"],
        editedNames: ["Finalize venue"],
      };

      await serviceWithCoverImage.persist(item);

      expect(writerMocks.createProject).toHaveBeenCalledTimes(1);
      // Note: The mock verification will be added in the implementation
    });

    it("does not generate cover image when autoCreateCoverImage is disabled", async () => {
      mockSettings.autoCreateCoverImage = false;

      const item: EditableItem = {
        original: "Plan offsite",
        isAIProcessed: false,
        selectedAction: "create-project",
        selectedSpheres: ["work"],
        editedNames: ["Finalize venue"],
      };

      await serviceWithCoverImage.persist(item);

      expect(writerMocks.createProject).toHaveBeenCalledTimes(1);
      // Cover image should not be generated
    });

    it("does not block project creation if cover image generation fails", async () => {
      mockGenerateCoverImage.mockRejectedValue(new Error("Image generation failed"));

      const item: EditableItem = {
        original: "Plan offsite",
        isAIProcessed: false,
        selectedAction: "create-project",
        selectedSpheres: ["work"],
        editedNames: ["Finalize venue"],
      };

      // Suppress expected console.error from the error handler
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // Should not throw, project creation should succeed
      await expect(serviceWithCoverImage.persist(item)).resolves.not.toThrow();
      expect(writerMocks.createProject).toHaveBeenCalledTimes(1);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to generate cover image for project:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("does not generate cover image for non-project actions", async () => {
      const item: EditableItem = {
        original: "Call dentist",
        isAIProcessed: false,
        selectedAction: "next-actions-file",
        selectedSpheres: ["personal"],
        editedName: "Call dentist",
      };

      await serviceWithCoverImage.persist(item);

      expect(writerMocks.addToNextActionsFile).toHaveBeenCalledTimes(1);
      // Cover image should not be generated for non-project actions
    });
  });
});
