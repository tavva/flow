// ABOUTME: Tests for accordion behavior in inbox processing view
// ABOUTME: Ensures only one item is expanded at a time with auto-expand on completion

import { InboxModalState } from "../src/inbox-modal-state";
import { InboxProcessingController } from "../src/inbox-processing-controller";
import { DEFAULT_SETTINGS } from "../src/types";
import { EditableItem } from "../src/inbox-types";

describe("Inbox Accordion State Logic", () => {
  let mockController: InboxProcessingController;
  let mockSettings: typeof DEFAULT_SETTINGS;

  beforeEach(() => {
    mockController = {
      saveItem: jest.fn().mockResolvedValue(undefined),
      discardInboxItem: jest.fn().mockResolvedValue(undefined),
    } as any;
    mockSettings = { ...DEFAULT_SETTINGS };
  });

  test("first item is marked as expanded on initialization", () => {
    const state = new InboxModalState(mockController, mockSettings, jest.fn());

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
    ];

    state.initializeExpandedState();

    expect(state.editableItems[0].isExpanded).toBe(true);
    expect(state.editableItems[1].isExpanded).toBe(false);
  });

  test("expanding an item collapses all others", () => {
    const renderCallback = jest.fn();
    const state = new InboxModalState(mockController, mockSettings, renderCallback);

    state.editableItems = [
      {
        original: "First item",
        selectedAction: "next-actions-file",
        selectedSpheres: ["personal"],
        isExpanded: true,
      } as EditableItem,
      {
        original: "Second item",
        selectedAction: "next-actions-file",
        selectedSpheres: ["work"],
        isExpanded: false,
      } as EditableItem,
      {
        original: "Third item",
        selectedAction: "create-project",
        selectedSpheres: ["personal"],
        isExpanded: false,
      } as EditableItem,
    ];

    state.expandItem(state.editableItems[1]);

    expect(state.editableItems[0].isExpanded).toBe(false);
    expect(state.editableItems[1].isExpanded).toBe(true);
    expect(state.editableItems[2].isExpanded).toBe(false);
    expect(renderCallback).toHaveBeenCalledWith("editable");
  });

  test("only one item is expanded at a time after expandItem", () => {
    const state = new InboxModalState(mockController, mockSettings, jest.fn());

    state.editableItems = [
      {
        original: "First item",
        selectedAction: "next-actions-file",
        selectedSpheres: ["personal"],
        isExpanded: true,
      } as EditableItem,
      {
        original: "Second item",
        selectedAction: "next-actions-file",
        selectedSpheres: ["work"],
        isExpanded: false,
      } as EditableItem,
    ];

    state.expandItem(state.editableItems[1]);

    const expandedCount = state.editableItems.filter((item) => item.isExpanded).length;
    expect(expandedCount).toBe(1);
  });

  test("after saving an item, next item expands automatically", async () => {
    const renderCallback = jest.fn();
    const state = new InboxModalState(mockController, mockSettings, renderCallback);

    const firstItem: EditableItem = {
      original: "First item",
      selectedAction: "next-actions-file",
      selectedSpheres: ["personal"],
      isExpanded: true,
    };

    const secondItem: EditableItem = {
      original: "Second item",
      selectedAction: "next-actions-file",
      selectedSpheres: ["work"],
      isExpanded: false,
    };

    state.editableItems = [firstItem, secondItem];

    await state.saveAndRemoveItem(firstItem);

    // After removing first item, second item becomes index 0 and should be expanded
    expect(state.editableItems.length).toBe(1);
    expect(state.editableItems[0].isExpanded).toBe(true);
    expect(state.editableItems[0].original).toBe("Second item");
  });

  test("after discarding an item, next item expands automatically", async () => {
    const renderCallback = jest.fn();
    const state = new InboxModalState(mockController, mockSettings, renderCallback);

    const firstItem: EditableItem = {
      original: "First item",
      selectedAction: "next-actions-file",
      selectedSpheres: ["personal"],
      isExpanded: true,
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
      isExpanded: false,
    };

    state.editableItems = [firstItem, secondItem];

    await state.discardItem(firstItem);

    // After removing first item, second item becomes index 0 and should be expanded
    expect(state.editableItems.length).toBe(1);
    expect(state.editableItems[0].isExpanded).toBe(true);
    expect(state.editableItems[0].original).toBe("Second item");
  });

  test("when last item is removed, no items remain to expand", async () => {
    const state = new InboxModalState(mockController, mockSettings, jest.fn());

    const lastItem: EditableItem = {
      original: "Last item",
      selectedAction: "next-actions-file",
      selectedSpheres: ["personal"],
      isExpanded: true,
    };

    state.editableItems = [lastItem];

    await state.saveAndRemoveItem(lastItem);

    expect(state.editableItems.length).toBe(0);
  });
});
