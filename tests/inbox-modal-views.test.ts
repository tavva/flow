// ABOUTME: Tests for inbox item persistence service
// ABOUTME: Ensures next actions are properly persisted for add-to-project actions

import { InboxItemPersistenceService } from "../src/inbox-item-persistence";
import { FileWriter } from "../src/file-writer";
import { EditableItem } from "../src/inbox-types";
import { FlowProject } from "../src/types";

describe("InboxItemPersistenceService - add-to-project with next actions", () => {
  let mockWriter: jest.Mocked<FileWriter>;
  let service: InboxItemPersistenceService;

  beforeEach(() => {
    mockWriter = {
      addNextActionToProject: jest.fn().mockResolvedValue(undefined),
    } as any;
    service = new InboxItemPersistenceService(mockWriter);
  });

  it("passes multiple next actions when adding to existing project", async () => {
    const project: FlowProject = {
      file: "Projects/Test.md",
      title: "Test Project",
      priority: 2,
      status: "live",
      tags: ["project/personal"],
      nextActions: [],
    };

    const item: EditableItem = {
      original: "Test inbox item",
      isAIProcessed: true,
      result: {
        isActionable: true,
        category: "project",
        nextAction: "First action from AI",
        nextActions: ["First action from AI", "Second action from AI"],
        reasoning: "Test reasoning",
        suggestedProjects: [],
        recommendedAction: "add-to-project",
        recommendedActionReasoning: "Test",
        recommendedSpheres: ["personal"],
        recommendedSpheresReasoning: "Test",
      },
      selectedAction: "add-to-project",
      selectedProject: project,
      selectedSpheres: ["personal"],
      editedNames: ["Edited first action", "Edited second action"],
    };

    await service.persist(item);

    expect(mockWriter.addNextActionToProject).toHaveBeenCalledWith(
      project,
      ["Edited first action", "Edited second action"],
      [false, false], // waitingFor
      [false, false] // markAsDone
    );
  });

  it("uses editedName when only one action is edited", async () => {
    const project: FlowProject = {
      file: "Projects/Test.md",
      title: "Test Project",
      priority: 2,
      status: "live",
      tags: ["project/personal"],
      nextActions: [],
    };

    const item: EditableItem = {
      original: "Test inbox item",
      isAIProcessed: true,
      result: {
        isActionable: true,
        category: "project",
        nextAction: "Action from AI",
        reasoning: "Test reasoning",
        suggestedProjects: [],
        recommendedAction: "add-to-project",
        recommendedActionReasoning: "Test",
        recommendedSpheres: ["personal"],
        recommendedSpheresReasoning: "Test",
      },
      selectedAction: "add-to-project",
      selectedProject: project,
      selectedSpheres: ["personal"],
      editedName: "Single edited action",
    };

    await service.persist(item);

    expect(mockWriter.addNextActionToProject).toHaveBeenCalledWith(
      project,
      ["Single edited action"],
      [false], // waitingFor
      [false] // markAsDone
    );
  });

  it("uses AI-suggested actions when no edits have been made", async () => {
    const project: FlowProject = {
      file: "Projects/Test.md",
      title: "Test Project",
      priority: 2,
      status: "live",
      tags: ["project/personal"],
      nextActions: [],
    };

    const item: EditableItem = {
      original: "Test inbox item",
      isAIProcessed: true,
      result: {
        isActionable: true,
        category: "project",
        nextAction: "First AI action",
        nextActions: ["First AI action", "Second AI action"],
        reasoning: "Test reasoning",
        suggestedProjects: [],
        recommendedAction: "add-to-project",
        recommendedActionReasoning: "Test",
        recommendedSpheres: ["personal"],
        recommendedSpheresReasoning: "Test",
      },
      selectedAction: "add-to-project",
      selectedProject: project,
      selectedSpheres: ["personal"],
    };

    await service.persist(item);

    expect(mockWriter.addNextActionToProject).toHaveBeenCalledWith(
      project,
      ["First AI action", "Second AI action"],
      [false, false], // waitingFor
      [false, false] // markAsDone
    );
  });
});
