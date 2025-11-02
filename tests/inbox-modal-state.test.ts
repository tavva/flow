import { InboxModalState } from "../src/inbox-modal-state";
import { EditableItem } from "../src/inbox-types";
import { DEFAULT_SETTINGS } from "../src/types";
import { InboxProcessingController } from "../src/inbox-processing-controller";

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
