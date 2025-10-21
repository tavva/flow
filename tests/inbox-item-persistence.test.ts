import { InboxItemPersistenceService } from "../src/inbox-item-persistence";
import { EditableItem } from "../src/inbox-types";
import { FileWriter } from "../src/file-writer";
import { GTDResponseValidationError } from "../src/errors";

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
      [false, false] // markAsDone
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
      [true, false] // markAsDone
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
      [true] // markAsDone
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

  it("does not add completed items to hotlist", async () => {
    const mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
      },
    };

    const mockSettings = {
      nextActionsFilePath: "Next actions.md",
      hotlist: [],
    };

    const mockSaveSettings = jest.fn();

    const serviceWithHotlist = new InboxItemPersistenceService(
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
      addToHotlist: true,
      markAsDone: [true],
    };

    await serviceWithHotlist.persist(item);

    // Should not attempt to add to hotlist because item is marked as done
    expect(mockSettings.hotlist.length).toBe(0);
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });
});
