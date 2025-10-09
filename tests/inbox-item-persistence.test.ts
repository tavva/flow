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
      createProject: jest.fn(),
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
    );
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

    Object.values(writerMocks).forEach(mockFn => {
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

    await expect(service.persist(item)).rejects.toThrow(
      GTDResponseValidationError
    );
    await expect(service.persist(item)).rejects.toThrow(
      "At least one sphere must be selected when creating a project."
    );
  });
});
