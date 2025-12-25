// ABOUTME: Tests for selection state behavior in inbox processing view
// ABOUTME: Ensures proper selection management when items are added, saved, or discarded

import { InboxModalState } from "../src/inbox-modal-state";
import { InboxProcessingController } from "../src/inbox-processing-controller";
import { DEFAULT_SETTINGS } from "../src/types";
import { EditableItem } from "../src/inbox-types";

describe("Inbox Selection State Logic", () => {
  let mockController: InboxProcessingController;
  let mockSettings: typeof DEFAULT_SETTINGS;

  beforeEach(() => {
    mockController = {
      saveItem: jest.fn().mockResolvedValue(undefined),
      discardInboxItem: jest.fn().mockResolvedValue(undefined),
    } as any;
    mockSettings = { ...DEFAULT_SETTINGS };
  });

  test("selectedIndex starts at -1 by default", () => {
    const state = new InboxModalState(mockController, mockSettings, jest.fn());
    expect(state.selectedIndex).toBe(-1);
  });

  test("selectItem updates selectedIndex correctly", () => {
    const renderCallback = jest.fn();
    const state = new InboxModalState(mockController, mockSettings, renderCallback);

    state.editableItems = [
      {
        original: "First item",
        selectedAction: "next-actions-file",
        selectedSpheres: ["personal"],
      } as EditableItem,
      {
        original: "Second item",
        selectedAction: "next-actions-file",
        selectedSpheres: ["work"],
      } as EditableItem,
      {
        original: "Third item",
        selectedAction: "create-project",
        selectedSpheres: ["personal"],
      } as EditableItem,
    ];
    state.selectedIndex = 0;

    state.selectItem(1);

    expect(state.selectedIndex).toBe(1);
    expect(state.selectedItem?.original).toBe("Second item");
    expect(renderCallback).toHaveBeenCalledWith("editable");
  });

  test("after saving an item, selectedIndex adjusts to stay in range", async () => {
    const renderCallback = jest.fn();
    const state = new InboxModalState(mockController, mockSettings, renderCallback);

    const firstItem: EditableItem = {
      original: "First item",
      selectedAction: "next-actions-file",
      selectedSpheres: ["personal"],
    };

    const secondItem: EditableItem = {
      original: "Second item",
      selectedAction: "next-actions-file",
      selectedSpheres: ["work"],
    };

    state.editableItems = [firstItem, secondItem];
    state.selectedIndex = 0;

    await state.saveAndRemoveItem(firstItem);

    // After removing first item, selectedIndex should remain at 0 (now pointing to second item)
    expect(state.editableItems.length).toBe(1);
    expect(state.selectedIndex).toBe(0);
    expect(state.selectedItem?.original).toBe("Second item");
  });

  test("after discarding an item, selectedIndex adjusts to stay in range", async () => {
    const renderCallback = jest.fn();
    const state = new InboxModalState(mockController, mockSettings, renderCallback);

    const firstItem: EditableItem = {
      original: "First item",
      selectedAction: "next-actions-file",
      selectedSpheres: ["personal"],
      inboxItem: {
        file: "test.md",
        lineNumber: 1,
        lineContent: "- First item",
        text: "First item",
      },
    };

    const secondItem: EditableItem = {
      original: "Second item",
      selectedAction: "next-actions-file",
      selectedSpheres: ["work"],
    };

    state.editableItems = [firstItem, secondItem];
    state.selectedIndex = 0;

    await state.discardItem(firstItem);

    // After removing first item, selectedIndex should remain at 0 (now pointing to second item)
    expect(state.editableItems.length).toBe(1);
    expect(state.selectedIndex).toBe(0);
    expect(state.selectedItem?.original).toBe("Second item");
  });

  test("when last item is removed, selectedIndex becomes -1", async () => {
    const state = new InboxModalState(mockController, mockSettings, jest.fn());

    const lastItem: EditableItem = {
      original: "Last item",
      selectedAction: "next-actions-file",
      selectedSpheres: ["personal"],
    };

    state.editableItems = [lastItem];
    state.selectedIndex = 0;

    await state.saveAndRemoveItem(lastItem);

    expect(state.editableItems.length).toBe(0);
    expect(state.selectedIndex).toBe(-1);
    expect(state.selectedItem).toBeUndefined();
  });

  test("removing item at end adjusts selectedIndex to last item", async () => {
    const state = new InboxModalState(mockController, mockSettings, jest.fn());

    const firstItem: EditableItem = {
      original: "First item",
      selectedAction: "next-actions-file",
      selectedSpheres: ["personal"],
    };

    const secondItem: EditableItem = {
      original: "Second item",
      selectedAction: "next-actions-file",
      selectedSpheres: ["work"],
    };

    state.editableItems = [firstItem, secondItem];
    state.selectedIndex = 1; // Select the last item

    await state.saveAndRemoveItem(secondItem);

    // After removing last item, selectedIndex should adjust to 0
    expect(state.editableItems.length).toBe(1);
    expect(state.selectedIndex).toBe(0);
    expect(state.selectedItem?.original).toBe("First item");
  });
});
