import { InboxModalState } from "../src/inbox-modal-state";
import { EditableItem } from "../src/inbox-types";
import { DEFAULT_SETTINGS, PluginSettings } from "../src/types";
import { InboxProcessingController } from "../src/inbox-processing-controller";

describe("InboxModalState AI toggle", () => {
  const createEditableItem = (): EditableItem => ({
    original: "Example",
    inboxItem: {
      type: "line",
      content: "Example",
      sourceFile: { path: "path/to/file.md" } as any,
      lineNumber: 1,
    },
    isAIProcessed: false,
    selectedAction: "next-actions-file",
    selectedSpheres: [],
  });

  describe("refineAllWithAI", () => {
    it("returns early with notice when AI is disabled", async () => {
      const controller = {} as InboxProcessingController;
      const render = jest.fn();
      const settings: PluginSettings = { ...DEFAULT_SETTINGS, aiEnabled: false };
      const state = new InboxModalState(controller, settings, render);

      state.editableItems = [createEditableItem()];

      await state.refineAllWithAI();

      expect(state.editableItems[0].isAIProcessed).toBe(false);
      expect(render).not.toHaveBeenCalled();
    });

    it("processes items when AI is enabled", async () => {
      const refineItem = jest.fn().mockResolvedValue({
        ...createEditableItem(),
        isAIProcessed: true,
      });
      const controller = { refineItem } as unknown as InboxProcessingController;
      const render = jest.fn();
      const settings: PluginSettings = { ...DEFAULT_SETTINGS, aiEnabled: true };
      const state = new InboxModalState(controller, settings, render);

      state.editableItems = [createEditableItem()];
      state.existingProjects = [];
      state.existingPersons = [];

      await state.refineAllWithAI();

      expect(refineItem).toHaveBeenCalled();
    });
  });

  describe("refineIndividualItem", () => {
    it("returns early with notice when AI is disabled", async () => {
      const controller = {} as InboxProcessingController;
      const render = jest.fn();
      const settings: PluginSettings = { ...DEFAULT_SETTINGS, aiEnabled: false };
      const state = new InboxModalState(controller, settings, render);

      const item = createEditableItem();
      state.editableItems = [item];

      await state.refineIndividualItem(item);

      expect(item.isAIProcessed).toBe(false);
      expect(render).not.toHaveBeenCalled();
    });

    it("processes item when AI is enabled", async () => {
      const refineItem = jest.fn().mockResolvedValue({
        ...createEditableItem(),
        isAIProcessed: true,
      });
      const controller = { refineItem } as unknown as InboxProcessingController;
      const render = jest.fn();
      const settings: PluginSettings = { ...DEFAULT_SETTINGS, aiEnabled: true };
      const state = new InboxModalState(controller, settings, render);

      const item = createEditableItem();
      state.editableItems = [item];
      state.existingProjects = [];
      state.existingPersons = [];

      await state.refineIndividualItem(item);

      expect(refineItem).toHaveBeenCalled();
    });
  });

  describe("suggestProjectName", () => {
    it("throws error when AI is disabled", async () => {
      const controller = {} as InboxProcessingController;
      const render = jest.fn();
      const settings: PluginSettings = { ...DEFAULT_SETTINGS, aiEnabled: false };
      const state = new InboxModalState(controller, settings, render);

      await expect(state.suggestProjectName("Example")).rejects.toThrow(
        "AI features are disabled"
      );
    });

    it("calls controller when AI is enabled", async () => {
      const suggestProjectName = jest.fn().mockResolvedValue("Suggested Name");
      const controller = { suggestProjectName } as unknown as InboxProcessingController;
      const render = jest.fn();
      const settings: PluginSettings = { ...DEFAULT_SETTINGS, aiEnabled: true };
      const state = new InboxModalState(controller, settings, render);

      const result = await state.suggestProjectName("Example");

      expect(suggestProjectName).toHaveBeenCalledWith("Example");
      expect(result).toBe("Suggested Name");
    });
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
    isAIProcessed: false,
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
