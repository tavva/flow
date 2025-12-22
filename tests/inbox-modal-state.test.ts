import { InboxModalState } from "../src/inbox-modal-state";
import { EditableItem, InboxItem } from "../src/inbox-types";
import { DEFAULT_SETTINGS, PluginSettings } from "../src/types";
import { InboxProcessingController } from "../src/inbox-processing-controller";

function createMockSettings(overrides: Partial<PluginSettings> = {}): PluginSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

function createTestState(options: { settings?: PluginSettings } = {}) {
  const settings = options.settings ?? createMockSettings();
  const controller = {
    loadExistingProjects: jest.fn().mockResolvedValue([]),
    loadExistingPersons: jest.fn().mockResolvedValue([]),
    loadInboxEditableItems: jest.fn().mockResolvedValue([]),
    saveItem: jest.fn().mockResolvedValue(undefined),
    discardInboxItem: jest.fn().mockResolvedValue(undefined),
    getInboxScanner: jest.fn().mockReturnValue({
      getAllInboxItems: jest.fn().mockResolvedValue([]),
      deleteInboxItem: jest.fn().mockResolvedValue(undefined),
    }),
    setInboxScanner: jest.fn(),
  } as unknown as InboxProcessingController;
  const render = jest.fn();
  const state = new InboxModalState(controller, settings, render);
  return { state, controller, render, settings };
}

function mockInboxScanner(items: InboxItem[]) {
  return {
    getAllInboxItems: jest.fn().mockResolvedValue(items),
    deleteInboxItem: jest.fn().mockResolvedValue(undefined),
  };
}

describe("InboxModalState selection state", () => {
  it("should initialise selectedIndex to 0 when items loaded", async () => {
    const { state, controller } = createTestState();
    (controller.loadInboxEditableItems as jest.Mock).mockResolvedValue([
      { original: "Item 1", selectedAction: "next-actions-file", selectedSpheres: [] },
      { original: "Item 2", selectedAction: "next-actions-file", selectedSpheres: [] },
    ]);

    await state.loadInboxItems();

    expect(state.selectedIndex).toBe(0);
  });

  it("should initialise selectedIndex to -1 when no items", async () => {
    const { state, controller } = createTestState();
    (controller.loadInboxEditableItems as jest.Mock).mockResolvedValue([]);

    await state.loadInboxItems();

    expect(state.selectedIndex).toBe(-1);
  });

  it("should update selectedIndex when selectItem called", async () => {
    const { state, controller } = createTestState();
    (controller.loadInboxEditableItems as jest.Mock).mockResolvedValue([
      { original: "Item 1", selectedAction: "next-actions-file", selectedSpheres: [] },
      { original: "Item 2", selectedAction: "next-actions-file", selectedSpheres: [] },
    ]);
    await state.loadInboxItems();

    state.selectItem(1);

    expect(state.selectedIndex).toBe(1);
  });

  it("should clamp selectedIndex to valid range", async () => {
    const { state, controller } = createTestState();
    (controller.loadInboxEditableItems as jest.Mock).mockResolvedValue([
      { original: "Item 1", selectedAction: "next-actions-file", selectedSpheres: [] },
      { original: "Item 2", selectedAction: "next-actions-file", selectedSpheres: [] },
    ]);
    await state.loadInboxItems();

    state.selectItem(99);
    expect(state.selectedIndex).toBe(1);

    state.selectItem(-5);
    expect(state.selectedIndex).toBe(0);
  });

  it("should return selected item via getter", async () => {
    const { state, controller } = createTestState();
    (controller.loadInboxEditableItems as jest.Mock).mockResolvedValue([
      { original: "Item 1", selectedAction: "next-actions-file", selectedSpheres: [] },
      { original: "Item 2", selectedAction: "next-actions-file", selectedSpheres: [] },
    ]);
    await state.loadInboxItems();

    state.selectItem(1);

    expect(state.selectedItem?.original).toBe("Item 2");
  });

  it("should return undefined for selectedItem when no items", async () => {
    const { state, controller } = createTestState();
    (controller.loadInboxEditableItems as jest.Mock).mockResolvedValue([]);
    await state.loadInboxItems();

    expect(state.selectedItem).toBeUndefined();
  });
});

describe("InboxModalState view mode", () => {
  it("should initialise viewMode to list", () => {
    const { state } = createTestState();
    expect(state.viewMode).toBe("list");
  });

  it("should switch to detail mode when showDetail called", () => {
    const { state } = createTestState();
    state.showDetail();
    expect(state.viewMode).toBe("detail");
  });

  it("should switch to list mode when showList called", () => {
    const { state } = createTestState();
    state.showDetail();
    state.showList();
    expect(state.viewMode).toBe("list");
  });
});

describe("InboxModalState discardItem", () => {
  const createEditableItem = (): EditableItem => ({
    original: "Example",
    inboxItem: {
      type: "line",
      content: "Example",
      sourceFile: { path: "path/to/file.md" } as any,
      lineNumber: 1,
    },
    selectedAction: "next-actions-file",
    selectedSpheres: [],
  });

  it("requests controller deletion before removing the item", async () => {
    const discardInboxItem = jest.fn().mockResolvedValue(undefined);
    const controller = { discardInboxItem } as unknown as InboxProcessingController;
    const render = jest.fn();
    const state = new InboxModalState(controller, DEFAULT_SETTINGS, render);
    const item = createEditableItem();

    state.editableItems = [item];

    await state.discardItem(item);

    expect(discardInboxItem).toHaveBeenCalledWith(item, state.deletionOffsets);
    expect(state.editableItems).toHaveLength(0);
    expect(render).toHaveBeenCalledWith("editable");
  });

  it("keeps the item when controller deletion fails", async () => {
    const discardInboxItem = jest.fn().mockRejectedValue(new Error("failed to delete inbox item"));
    const controller = { discardInboxItem } as unknown as InboxProcessingController;
    const render = jest.fn();
    const state = new InboxModalState(controller, DEFAULT_SETTINGS, render);
    const item = createEditableItem();

    state.editableItems = [item];

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await state.discardItem(item);

    expect(discardInboxItem).toHaveBeenCalled();
    expect(state.editableItems).toHaveLength(1);
    expect(render).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("removes items without inbox metadata immediately", async () => {
    const discardInboxItem = jest.fn();
    const controller = { discardInboxItem } as unknown as InboxProcessingController;
    const render = jest.fn();
    const state = new InboxModalState(controller, DEFAULT_SETTINGS, render);

    const item: EditableItem = {
      original: "Example",
      isAIProcessed: false,
      selectedAction: "next-actions-file",
      selectedSpheres: [],
    };

    state.editableItems = [item];

    await state.discardItem(item);

    expect(discardInboxItem).not.toHaveBeenCalled();
    expect(state.editableItems).toHaveLength(0);
    expect(render).toHaveBeenCalledWith("editable");
  });
});

describe("InboxModalState saveAndRemoveItem with project creation", () => {
  it("refreshes project list after creating a new project", async () => {
    const initialProjects = [
      {
        title: "Existing Project",
        file: "Projects/Existing.md",
        priority: 1,
        status: "live",
        tags: ["project/personal"],
      },
    ];

    const updatedProjects = [
      ...initialProjects,
      {
        title: "New Project",
        file: "Projects/New.md",
        priority: 2,
        status: "live",
        tags: ["project/work"],
      },
    ];

    const loadExistingProjects = jest
      .fn()
      .mockResolvedValueOnce(initialProjects)
      .mockResolvedValueOnce(updatedProjects);

    const loadExistingPersons = jest.fn().mockResolvedValue([]);
    const saveItem = jest.fn().mockResolvedValue(undefined);

    const controller = {
      loadExistingProjects,
      loadExistingPersons,
      saveItem,
    } as unknown as InboxProcessingController;

    const render = jest.fn();
    const state = new InboxModalState(controller, DEFAULT_SETTINGS, render);

    // Load initial reference data
    await state.loadReferenceData();
    expect(state.existingProjects).toEqual(initialProjects);
    expect(loadExistingProjects).toHaveBeenCalledTimes(1);

    // Create an item that will create a new project
    const item: EditableItem = {
      original: "Build new feature",
      selectedAction: "create-project",
      selectedSpheres: ["work"],
      editedProjectTitle: "New Project",
      editedName: "Define requirements",
    };

    // Save the item (which creates a new project)
    await state.saveAndRemoveItem(item);

    // Verify that projects were reloaded
    expect(loadExistingProjects).toHaveBeenCalledTimes(2);
    expect(state.existingProjects).toEqual(updatedProjects);
  });

  it("does not refresh project list when action is not create-project", async () => {
    const initialProjects = [
      {
        title: "Existing Project",
        file: "Projects/Existing.md",
        priority: 1,
        status: "live",
        tags: ["project/personal"],
      },
    ];

    const loadExistingProjects = jest.fn().mockResolvedValue(initialProjects);
    const loadExistingPersons = jest.fn().mockResolvedValue([]);
    const saveItem = jest.fn().mockResolvedValue(undefined);

    const controller = {
      loadExistingProjects,
      loadExistingPersons,
      saveItem,
    } as unknown as InboxProcessingController;

    const render = jest.fn();
    const state = new InboxModalState(controller, DEFAULT_SETTINGS, render);

    // Load initial reference data
    await state.loadReferenceData();
    expect(loadExistingProjects).toHaveBeenCalledTimes(1);

    // Create an item that adds to next actions (not create-project)
    const item: EditableItem = {
      original: "Call dentist",
      selectedAction: "next-actions-file",
      selectedSpheres: ["personal"],
      editedName: "Call dentist to schedule appointment",
    };

    // Save the item
    await state.saveAndRemoveItem(item);

    // Verify that projects were NOT reloaded (still only 1 call from loadReferenceData)
    expect(loadExistingProjects).toHaveBeenCalledTimes(1);
  });
});
