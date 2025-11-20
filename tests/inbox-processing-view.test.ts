import { App, WorkspaceLeaf } from "obsidian";
import { InboxProcessingView, INBOX_PROCESSING_VIEW_TYPE } from "../src/inbox-processing-view";
import { DEFAULT_SETTINGS } from "../src/types";
import { InboxModalState } from "../src/inbox-modal-state";
import { renderInboxView, renderEditableItemsView } from "../src/inbox-modal-views";
import { generateDeterministicFakeApiKey } from "./test-utils";

// Mock the view modules
jest.mock("../src/inbox-modal-views", () => ({
  renderInboxView: jest.fn(),
  renderEditableItemsView: jest.fn(),
}));

describe("InboxProcessingView", () => {
  let mockApp: App;
  let mockLeaf: WorkspaceLeaf;

  const testSettings = {
    ...DEFAULT_SETTINGS,
    openaiApiKey: generateDeterministicFakeApiKey("inbox-processing-view"),
  };

  let mockSaveSettings: jest.Mock;

  beforeEach(() => {
    mockApp = {} as App;
    mockLeaf = {
      view: null,
    } as unknown as WorkspaceLeaf;
    mockSaveSettings = jest.fn().mockResolvedValue(undefined);
  });

  test("returns correct view type", () => {
    const view = new InboxProcessingView(mockLeaf, testSettings, mockSaveSettings);
    expect(view.getViewType()).toBe(INBOX_PROCESSING_VIEW_TYPE);
  });

  test("returns correct display text", () => {
    const view = new InboxProcessingView(mockLeaf, testSettings, mockSaveSettings);
    expect(view.getDisplayText()).toBe("Flow Inbox Processing");
  });

  test("returns correct icon", () => {
    const view = new InboxProcessingView(mockLeaf, testSettings, mockSaveSettings);
    expect(view.getIcon()).toBe("inbox");
  });

  test("initializes state on open", async () => {
    const view = new InboxProcessingView(mockLeaf, testSettings, mockSaveSettings);

    // Mock containerEl with necessary structure
    const mockContainer = {
      empty: jest.fn(),
      addClass: jest.fn(),
      createEl: jest.fn().mockReturnValue({
        addEventListener: jest.fn(),
        createEl: jest.fn(),
        style: {},
      }),
      createDiv: jest.fn().mockReturnValue({
        createEl: jest.fn(),
        style: {},
      }),
    };
    (view as any).containerEl = {
      children: [null, mockContainer],
    };

    // Mock state methods directly to avoid triggering full loading chain
    const loadReferenceDataMock = jest
      .spyOn((view as any).state, "loadReferenceData")
      .mockResolvedValue(undefined);
    const loadInboxItemsMock = jest
      .spyOn((view as any).state, "loadInboxItems")
      .mockResolvedValue(undefined);

    await view.onOpen();

    // Verify state was initialized
    expect((view as any).state).toBeDefined();
    expect((view as any).state).toBeInstanceOf(InboxModalState);

    // Verify state methods were called
    expect(loadReferenceDataMock).toHaveBeenCalled();
    expect(loadInboxItemsMock).toHaveBeenCalled();

    // Verify container was set up
    expect(mockContainer.empty).toHaveBeenCalled();
    expect(mockContainer.addClass).toHaveBeenCalledWith("flow-gtd-inbox-modal");
  });

  test("handles render requests with debouncing", async () => {
    jest.useFakeTimers();

    const view = new InboxProcessingView(mockLeaf, testSettings, mockSaveSettings);
    const mockContainer = {
      empty: jest.fn(),
      addClass: jest.fn(),
      createEl: jest.fn().mockReturnValue({
        addEventListener: jest.fn(),
        createEl: jest.fn(),
        style: {},
      }),
      createDiv: jest.fn().mockReturnValue({
        createEl: jest.fn(),
        style: {},
      }),
    };
    (view as any).containerEl = {
      children: [null, mockContainer],
    };

    // Mock state methods to avoid full loading
    jest.spyOn((view as any).state, "loadReferenceData").mockResolvedValue(undefined);
    jest.spyOn((view as any).state, "loadInboxItems").mockResolvedValue(undefined);

    await view.onOpen();

    // Clear previous calls from onOpen
    (renderEditableItemsView as jest.Mock).mockClear();

    // Trigger render request
    (view as any).requestRender("editable", false);

    // Should not render immediately
    expect(renderEditableItemsView).not.toHaveBeenCalled();

    // Fast-forward time
    jest.advanceTimersByTime(50);

    // Should render after debounce
    expect(renderEditableItemsView).toHaveBeenCalled();

    jest.useRealTimers();
  });

  test("handles immediate render requests", async () => {
    const view = new InboxProcessingView(mockLeaf, testSettings, mockSaveSettings);
    const mockContainer = {
      empty: jest.fn(),
      addClass: jest.fn(),
      createEl: jest.fn().mockReturnValue({
        addEventListener: jest.fn(),
        createEl: jest.fn(),
        style: {},
      }),
      createDiv: jest.fn().mockReturnValue({
        createEl: jest.fn(),
        style: {},
      }),
    };
    (view as any).containerEl = {
      children: [null, mockContainer],
    };

    // Mock state methods to avoid full loading
    jest.spyOn((view as any).state, "loadReferenceData").mockResolvedValue(undefined);
    jest.spyOn((view as any).state, "loadInboxItems").mockResolvedValue(undefined);

    await view.onOpen();

    // Clear previous calls from onOpen
    (renderEditableItemsView as jest.Mock).mockClear();

    // Trigger immediate render
    (view as any).requestRender("editable", true);

    // Should render immediately
    expect(renderEditableItemsView).toHaveBeenCalled();
  });

  test("renders inbox target view", async () => {
    const view = new InboxProcessingView(mockLeaf, testSettings, mockSaveSettings);
    const mockContainer = {
      empty: jest.fn(),
      addClass: jest.fn(),
      createEl: jest.fn().mockReturnValue({
        addEventListener: jest.fn(),
        createEl: jest.fn(),
        style: {},
      }),
      createDiv: jest.fn().mockReturnValue({
        createEl: jest.fn(),
        style: {},
      }),
    };
    (view as any).containerEl = {
      children: [null, mockContainer],
    };

    // Mock state methods to avoid full loading
    jest.spyOn((view as any).state, "loadReferenceData").mockResolvedValue(undefined);
    jest.spyOn((view as any).state, "loadInboxItems").mockResolvedValue(undefined);

    await view.onOpen();

    // Clear previous calls from onOpen
    (renderInboxView as jest.Mock).mockClear();
    (renderEditableItemsView as jest.Mock).mockClear();

    // Trigger immediate render with inbox target
    (view as any).requestRender("inbox", true);

    // Should render inbox view
    expect(renderInboxView).toHaveBeenCalled();
    expect(renderEditableItemsView).not.toHaveBeenCalled();
  });

  test("handles missing container gracefully", async () => {
    const view = new InboxProcessingView(mockLeaf, testSettings, mockSaveSettings);

    // Set up containerEl with no children
    (view as any).containerEl = {
      children: [],
    };

    // Clear any previous mock calls
    (renderEditableItemsView as jest.Mock).mockClear();
    (renderInboxView as jest.Mock).mockClear();

    // Trigger render with missing container - should not throw
    (view as any).requestRender("editable", true);

    // Should not call render functions
    expect(renderEditableItemsView).not.toHaveBeenCalled();
    expect(renderInboxView).not.toHaveBeenCalled();
  });

  test("cancels previous timeout on multiple rapid renders", async () => {
    jest.useFakeTimers();

    const view = new InboxProcessingView(mockLeaf, testSettings, mockSaveSettings);
    const mockContainer = {
      empty: jest.fn(),
      addClass: jest.fn(),
      createEl: jest.fn().mockReturnValue({
        addEventListener: jest.fn(),
        createEl: jest.fn(),
        style: {},
      }),
      createDiv: jest.fn().mockReturnValue({
        createEl: jest.fn(),
        style: {},
      }),
    };
    (view as any).containerEl = {
      children: [null, mockContainer],
    };

    // Mock state methods to avoid full loading
    jest.spyOn((view as any).state, "loadReferenceData").mockResolvedValue(undefined);
    jest.spyOn((view as any).state, "loadInboxItems").mockResolvedValue(undefined);

    await view.onOpen();

    // Clear previous calls from onOpen
    (renderEditableItemsView as jest.Mock).mockClear();
    (renderInboxView as jest.Mock).mockClear();

    // Trigger first render request
    (view as any).requestRender("editable", false);

    // Advance time partially
    jest.advanceTimersByTime(25);

    // Trigger second render request before first completes
    (view as any).requestRender("inbox", false);

    // Advance time to complete debounce
    jest.advanceTimersByTime(50);

    // Only the second render should have executed
    expect(renderEditableItemsView).not.toHaveBeenCalled();
    expect(renderInboxView).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  test("handles handleClose by detaching leaves", async () => {
    const view = new InboxProcessingView(mockLeaf, testSettings, mockSaveSettings);
    const mockContainer = {
      empty: jest.fn(),
      addClass: jest.fn(),
      createEl: jest.fn().mockReturnValue({
        addEventListener: jest.fn(),
        createEl: jest.fn(),
        style: {},
      }),
      createDiv: jest.fn().mockReturnValue({
        createEl: jest.fn(),
        style: {},
      }),
    };
    (view as any).containerEl = {
      children: [null, mockContainer],
    };

    // Mock workspace.detachLeavesOfType
    const detachMock = jest.fn();
    (view as any).app = {
      workspace: {
        detachLeavesOfType: detachMock,
      },
    };

    // Mock state methods to avoid full loading
    jest.spyOn((view as any).state, "loadReferenceData").mockResolvedValue(undefined);
    jest.spyOn((view as any).state, "loadInboxItems").mockResolvedValue(undefined);

    await view.onOpen();

    // Call handleClose directly
    (view as any).handleClose();

    // Verify detachLeavesOfType was called with correct view type
    expect(detachMock).toHaveBeenCalledWith(INBOX_PROCESSING_VIEW_TYPE);
  });

  test("renders empty state when no inbox items exist", async () => {
    jest.useFakeTimers();

    const view = new InboxProcessingView(mockLeaf, testSettings, mockSaveSettings);
    const mockContainer = {
      empty: jest.fn(),
      addClass: jest.fn(),
      createEl: jest.fn().mockReturnValue({
        addEventListener: jest.fn(),
        createEl: jest.fn(),
        style: {},
      }),
      createDiv: jest.fn().mockReturnValue({
        createEl: jest.fn(),
        style: {},
      }),
    };
    (view as any).containerEl = {
      children: [null, mockContainer],
    };

    // Mock state methods - loadInboxItems should result in empty state
    jest.spyOn((view as any).state, "loadReferenceData").mockResolvedValue(undefined);
    const loadInboxItemsMock = jest
      .spyOn((view as any).state, "loadInboxItems")
      .mockImplementation(async () => {
        // Simulate no items found
        (view as any).state.editableItems = [];
        (view as any).state.isLoadingInbox = false;
        (view as any).state.requestRender("inbox");
      });

    await view.onOpen();

    // Advance timers to trigger debounced render
    jest.advanceTimersByTime(50);

    // Verify renderInboxView was called with isLoading: false on the last call
    const calls = (renderInboxView as jest.Mock).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[2]).toEqual(expect.objectContaining({ isLoading: false }));

    jest.useRealTimers();
  });

  describe("keyboard shortcuts", () => {
    let view: InboxProcessingView;
    let mockContainer: any;
    let addEventListenerSpy: jest.SpyInstance;
    let removeEventListenerSpy: jest.SpyInstance;
    let handleKeyDown: (event: KeyboardEvent) => void;

    beforeEach(async () => {
      view = new InboxProcessingView(mockLeaf, testSettings, mockSaveSettings);
      mockContainer = {
        empty: jest.fn(),
        addClass: jest.fn(),
        createEl: jest.fn().mockReturnValue({
          addEventListener: jest.fn(),
          createEl: jest.fn(),
          style: {},
        }),
        createDiv: jest.fn().mockReturnValue({
          createEl: jest.fn(),
          style: {},
        }),
        querySelector: jest.fn(),
      };
      (view as any).containerEl = {
        children: [null, mockContainer],
      };

      // Mock state methods
      jest.spyOn((view as any).state, "loadReferenceData").mockResolvedValue(undefined);
      jest.spyOn((view as any).state, "loadInboxItems").mockResolvedValue(undefined);

      // Mock window.addEventListener
      addEventListenerSpy = jest.spyOn(window, "addEventListener");
      removeEventListenerSpy = jest.spyOn(window, "removeEventListener");

      // Mock app.workspace.getActiveViewOfType
      (view as any).app = {
        workspace: {
          getActiveViewOfType: jest.fn().mockReturnValue(view),
        },
      };

      await view.onOpen();

      // Capture the event handler
      const calls = addEventListenerSpy.mock.calls;
      const keydownCall = calls.find((call) => call[0] === "keydown");
      if (keydownCall) {
        handleKeyDown = keydownCall[1];
      }
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("registers keydown listener on open", () => {
      expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    test("removes keydown listener on close", async () => {
      await view.onClose();
      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    test("ignores keydown when view is not active", () => {
      // Mock view as not active
      ((view as any).app.workspace.getActiveViewOfType as jest.Mock).mockReturnValue(null);

      const item = { isExpanded: true, selectedAction: "next-actions-file" } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "c",
        target: document.body,
        preventDefault: jest.fn(),
      } as any);

      expect(item.selectedAction).toBe("next-actions-file");
      expect(queueRenderSpy).not.toHaveBeenCalled();
    });

    test("ignores keydown when typing in input", () => {
      const item = { isExpanded: true, selectedAction: "next-actions-file" } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      const inputEl = document.createElement("input");
      handleKeyDown({
        key: "c",
        target: inputEl,
        preventDefault: jest.fn(),
      } as any);

      expect(item.selectedAction).toBe("next-actions-file");
      expect(queueRenderSpy).not.toHaveBeenCalled();
    });

    test("updates selected action for expanded item", () => {
      const item = { isExpanded: true, selectedAction: "next-actions-file" } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");
      const preventDefaultSpy = jest.fn();

      // Test 'c' -> create-project
      handleKeyDown({
        key: "c",
        target: document.body,
        preventDefault: preventDefaultSpy,
      } as any);
      expect(item.selectedAction).toBe("create-project");
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
      expect(preventDefaultSpy).toHaveBeenCalled();

      // Test 'a' -> add-to-project
      handleKeyDown({
        key: "a",
        target: document.body,
        preventDefault: preventDefaultSpy,
      } as any);
      expect(item.selectedAction).toBe("add-to-project");

      // Test 'r' -> reference
      handleKeyDown({
        key: "r",
        target: document.body,
        preventDefault: preventDefaultSpy,
      } as any);
      expect(item.selectedAction).toBe("reference");

      // Test 'n' -> next-actions-file
      handleKeyDown({
        key: "n",
        target: document.body,
        preventDefault: preventDefaultSpy,
      } as any);
      expect(item.selectedAction).toBe("next-actions-file");

      // Test 's' -> someday-file
      handleKeyDown({
        key: "s",
        target: document.body,
        preventDefault: preventDefaultSpy,
      } as any);
      expect(item.selectedAction).toBe("someday-file");

      // Test 'p' -> person
      handleKeyDown({
        key: "p",
        target: document.body,
        preventDefault: preventDefaultSpy,
      } as any);
      expect(item.selectedAction).toBe("person");

      // Test 't' -> trash
      handleKeyDown({
        key: "t",
        target: document.body,
        preventDefault: preventDefaultSpy,
      } as any);
      expect(item.selectedAction).toBe("trash");
    });

    test("ignores unknown keys", () => {
      const item = { isExpanded: true, selectedAction: "next-actions-file" } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "z",
        target: document.body,
        preventDefault: jest.fn(),
      } as any);

      expect(item.selectedAction).toBe("next-actions-file");
      expect(queueRenderSpy).not.toHaveBeenCalled();
    });

    test("Ctrl+Q blurs input focus", () => {
      const blurSpy = jest.fn();
      const preventDefaultSpy = jest.fn();
      const stopPropagationSpy = jest.fn();
      const inputEl = {
        tagName: "INPUT",
        blur: blurSpy,
      };

      handleKeyDown({
        key: "q",
        ctrlKey: true,
        target: inputEl,
        preventDefault: preventDefaultSpy,
        stopPropagation: stopPropagationSpy,
      } as any);

      expect(blurSpy).toHaveBeenCalled();
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    test("Cmd+Q blurs input focus (Mac)", () => {
      const blurSpy = jest.fn();
      const preventDefaultSpy = jest.fn();
      const stopPropagationSpy = jest.fn();
      const inputEl = {
        tagName: "INPUT",
        blur: blurSpy,
      };

      handleKeyDown({
        key: "q",
        metaKey: true,
        target: inputEl,
        preventDefault: preventDefaultSpy,
        stopPropagation: stopPropagationSpy,
      } as any);

      expect(blurSpy).toHaveBeenCalled();
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    test("Ctrl+Enter saves the current item", () => {
      const item = { isExpanded: true, selectedAction: "next-actions-file" } as any;
      (view as any).state.editableItems = [item];
      const saveAndRemoveItemSpy = jest.spyOn((view as any).state, "saveAndRemoveItem");
      const preventDefaultSpy = jest.fn();
      const stopPropagationSpy = jest.fn();

      handleKeyDown({
        key: "Enter",
        ctrlKey: true,
        target: document.body,
        preventDefault: preventDefaultSpy,
        stopPropagation: stopPropagationSpy,
      } as any);

      expect(saveAndRemoveItemSpy).toHaveBeenCalledWith(item);
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    test("Cmd+Enter saves the current item (Mac)", () => {
      const item = { isExpanded: true, selectedAction: "next-actions-file" } as any;
      (view as any).state.editableItems = [item];
      const saveAndRemoveItemSpy = jest.spyOn((view as any).state, "saveAndRemoveItem");
      const preventDefaultSpy = jest.fn();
      const stopPropagationSpy = jest.fn();

      handleKeyDown({
        key: "Enter",
        metaKey: true,
        target: document.body,
        preventDefault: preventDefaultSpy,
        stopPropagation: stopPropagationSpy,
      } as any);

      expect(saveAndRemoveItemSpy).toHaveBeenCalledWith(item);
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    test("sets pending focus for Create Project action", () => {
      const item = { isExpanded: true, selectedAction: "next-actions-file" } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "c",
        target: document.body,
        preventDefault: jest.fn(),
      } as any);

      expect(item.selectedAction).toBe("create-project");
      expect((view as any).pendingFocus).toBe(".flow-gtd-project-input");
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
    });

    test("sets pending focus for Add to Project action", () => {
      const item = { isExpanded: true, selectedAction: "next-actions-file" } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "a",
        target: document.body,
        preventDefault: jest.fn(),
      } as any);

      expect(item.selectedAction).toBe("add-to-project");
      expect((view as any).pendingFocus).toBe(".flow-gtd-project-search");
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
    });

    test("applies focus after render", () => {
      jest.useFakeTimers();
      (view as any).pendingFocus = ".test-input";

      const mockInput = { focus: jest.fn() };
      const mockContainer = (view as any).containerEl.children[1];
      mockContainer.querySelector = jest.fn().mockReturnValue(mockInput);

      // Trigger render
      (view as any).renderCurrentView("editable");

      // Advance timers for setTimeout
      jest.runAllTimers();

      expect(mockContainer.querySelector).toHaveBeenCalledWith(".test-input");
      expect(mockInput.focus).toHaveBeenCalled();
      expect((view as any).pendingFocus).toBeNull();

      jest.useRealTimers();
    });

    test("Ctrl+1 toggles first sphere selection", () => {
      const settings = (view as any).settings;
      settings.spheres = ["work", "personal"];

      const item = {
        isExpanded: true,
        selectedAction: "next-actions-file",
        selectedSpheres: [] as string[],
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");
      const preventDefaultSpy = jest.fn();
      const stopPropagationSpy = jest.fn();

      handleKeyDown({
        key: "1",
        ctrlKey: true,
        target: document.body,
        preventDefault: preventDefaultSpy,
        stopPropagation: stopPropagationSpy,
      } as any);

      expect(item.selectedSpheres).toEqual(["work"]);
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    test("Ctrl+2 toggles second sphere selection", () => {
      const settings = (view as any).settings;
      settings.spheres = ["work", "personal"];

      const item = {
        isExpanded: true,
        selectedAction: "create-project",
        selectedSpheres: [] as string[],
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "2",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);

      expect(item.selectedSpheres).toEqual(["personal"]);
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
    });

    test("Cmd+1 toggles first sphere selection (Mac)", () => {
      const settings = (view as any).settings;
      settings.spheres = ["work", "personal"];

      const item = {
        isExpanded: true,
        selectedAction: "next-actions-file",
        selectedSpheres: [] as string[],
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "1",
        metaKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);

      expect(item.selectedSpheres).toEqual(["work"]);
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
    });

    test("Ctrl+1 deselects already selected sphere", () => {
      const settings = (view as any).settings;
      settings.spheres = ["work", "personal"];

      const item = {
        isExpanded: true,
        selectedAction: "next-actions-file",
        selectedSpheres: ["work"],
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "1",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);

      expect(item.selectedSpheres).toEqual([]);
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
    });

    test("sphere shortcuts ignored for add-to-project action", () => {
      const settings = (view as any).settings;
      settings.spheres = ["work", "personal"];

      const item = {
        isExpanded: true,
        selectedAction: "add-to-project",
        selectedSpheres: [] as string[],
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "1",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);

      expect(item.selectedSpheres).toEqual([]);
      expect(queueRenderSpy).not.toHaveBeenCalled();
    });

    test("sphere shortcuts ignored for reference action", () => {
      const settings = (view as any).settings;
      settings.spheres = ["work", "personal"];

      const item = {
        isExpanded: true,
        selectedAction: "reference",
        selectedSpheres: [] as string[],
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "1",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);

      expect(item.selectedSpheres).toEqual([]);
      expect(queueRenderSpy).not.toHaveBeenCalled();
    });

    test("sphere shortcuts ignored for trash action", () => {
      const settings = (view as any).settings;
      settings.spheres = ["work", "personal"];

      const item = {
        isExpanded: true,
        selectedAction: "trash",
        selectedSpheres: [] as string[],
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "1",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);

      expect(item.selectedSpheres).toEqual([]);
      expect(queueRenderSpy).not.toHaveBeenCalled();
    });

    test("sphere shortcuts ignored for out of range indices", () => {
      const settings = (view as any).settings;
      settings.spheres = ["work", "personal"];

      const item = {
        isExpanded: true,
        selectedAction: "next-actions-file",
        selectedSpheres: [] as string[],
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      // Try Ctrl+3 when only 2 spheres exist
      handleKeyDown({
        key: "3",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);

      expect(item.selectedSpheres).toEqual([]);
      expect(queueRenderSpy).not.toHaveBeenCalled();
    });

    test("Ctrl+L toggles Add to focus checkbox", () => {
      const item = {
        isExpanded: true,
        selectedAction: "next-actions-file",
        addToFocus: false,
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");
      const preventDefaultSpy = jest.fn();
      const stopPropagationSpy = jest.fn();

      handleKeyDown({
        key: "l",
        ctrlKey: true,
        target: document.body,
        preventDefault: preventDefaultSpy,
        stopPropagation: stopPropagationSpy,
      } as any);

      expect(item.addToFocus).toBe(true);
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    test("Cmd+L toggles Add to focus checkbox (Mac)", () => {
      const item = {
        isExpanded: true,
        selectedAction: "create-project",
        addToFocus: false,
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "l",
        metaKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);

      expect(item.addToFocus).toBe(true);
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
    });

    test("Ctrl+L unchecks Mark as done when toggling Add to focus on", () => {
      const item = {
        isExpanded: true,
        selectedAction: "next-actions-file",
        addToFocus: false,
        markAsDone: [true],
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "l",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);

      expect(item.addToFocus).toBe(true);
      expect(item.markAsDone[0]).toBe(false);
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
    });

    test("Ctrl+D toggles Mark as done checkbox", () => {
      const item = {
        isExpanded: true,
        selectedAction: "next-actions-file",
        markAsDone: [false],
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");
      const preventDefaultSpy = jest.fn();
      const stopPropagationSpy = jest.fn();

      handleKeyDown({
        key: "d",
        ctrlKey: true,
        target: document.body,
        preventDefault: preventDefaultSpy,
        stopPropagation: stopPropagationSpy,
      } as any);

      expect(item.markAsDone[0]).toBe(true);
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    test("Cmd+D toggles Mark as done checkbox (Mac)", () => {
      const item = {
        isExpanded: true,
        selectedAction: "create-project",
        markAsDone: [false],
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "d",
        metaKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);

      expect(item.markAsDone[0]).toBe(true);
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
    });

    test("Ctrl+D initializes markAsDone array if not exists", () => {
      const item = {
        isExpanded: true,
        selectedAction: "next-actions-file",
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "d",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);

      expect(item.markAsDone).toEqual([true]);
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
    });

    test("Ctrl+D unchecks Add to focus when toggling Mark as done on", () => {
      const item = {
        isExpanded: true,
        selectedAction: "next-actions-file",
        addToFocus: true,
        markAsDone: [false],
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "d",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);

      expect(item.markAsDone[0]).toBe(true);
      expect(item.addToFocus).toBe(false);
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
    });

    test("Ctrl+T toggles date section expansion", () => {
      const item = {
        isExpanded: true,
        selectedAction: "next-actions-file",
        isDateSectionExpanded: false,
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");
      const preventDefaultSpy = jest.fn();
      const stopPropagationSpy = jest.fn();

      handleKeyDown({
        key: "t",
        ctrlKey: true,
        target: document.body,
        preventDefault: preventDefaultSpy,
        stopPropagation: stopPropagationSpy,
      } as any);

      expect(item.isDateSectionExpanded).toBe(true);
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    test("Cmd+T toggles date section expansion (Mac)", () => {
      const item = {
        isExpanded: true,
        selectedAction: "someday-file",
        isDateSectionExpanded: true,
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      handleKeyDown({
        key: "t",
        metaKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);

      expect(item.isDateSectionExpanded).toBe(false);
      expect(queueRenderSpy).toHaveBeenCalledWith("editable");
    });

    test("Ctrl+L/D/T ignored for reference action", () => {
      const item = {
        isExpanded: true,
        selectedAction: "reference",
        addToFocus: false,
        markAsDone: [false],
        isDateSectionExpanded: false,
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      // Try Ctrl+L
      handleKeyDown({
        key: "l",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);
      expect(item.addToFocus).toBe(false);
      expect(queueRenderSpy).not.toHaveBeenCalled();

      // Try Ctrl+D
      handleKeyDown({
        key: "d",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);
      expect(item.markAsDone[0]).toBe(false);
      expect(queueRenderSpy).not.toHaveBeenCalled();

      // Try Ctrl+T
      handleKeyDown({
        key: "t",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);
      expect(item.isDateSectionExpanded).toBe(false);
      expect(queueRenderSpy).not.toHaveBeenCalled();
    });

    test("Ctrl+L/D/T ignored for trash action", () => {
      const item = {
        isExpanded: true,
        selectedAction: "trash",
        addToFocus: false,
        markAsDone: [false],
        isDateSectionExpanded: false,
      } as any;
      (view as any).state.editableItems = [item];
      const queueRenderSpy = jest.spyOn((view as any).state, "queueRender");

      // Try Ctrl+L
      handleKeyDown({
        key: "l",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);
      expect(item.addToFocus).toBe(false);
      expect(queueRenderSpy).not.toHaveBeenCalled();

      // Try Ctrl+D
      handleKeyDown({
        key: "d",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);
      expect(item.markAsDone[0]).toBe(false);
      expect(queueRenderSpy).not.toHaveBeenCalled();

      // Try Ctrl+T
      handleKeyDown({
        key: "t",
        ctrlKey: true,
        target: document.body,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any);
      expect(item.isDateSectionExpanded).toBe(false);
      expect(queueRenderSpy).not.toHaveBeenCalled();
    });
  });
});
