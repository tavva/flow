import { App, WorkspaceLeaf } from "obsidian";
import { InboxProcessingView, INBOX_PROCESSING_VIEW_TYPE } from "../src/inbox-processing-view";
import { DEFAULT_SETTINGS } from "../src/types";
import { InboxModalState } from "../src/inbox-modal-state";
import { renderInboxView, renderEditableItemsView } from "../src/inbox-modal-views";

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
    openaiApiKey: "test-api-key",
  };

  beforeEach(() => {
    mockApp = {} as App;
    mockLeaf = {
      view: null,
    } as WorkspaceLeaf;
  });

  test("returns correct view type", () => {
    const view = new InboxProcessingView(mockLeaf, testSettings);
    expect(view.getViewType()).toBe(INBOX_PROCESSING_VIEW_TYPE);
  });

  test("returns correct display text", () => {
    const view = new InboxProcessingView(mockLeaf, testSettings);
    expect(view.getDisplayText()).toBe("Flow Inbox Processing");
  });

  test("returns correct icon", () => {
    const view = new InboxProcessingView(mockLeaf, testSettings);
    expect(view.getIcon()).toBe("inbox");
  });

  test("initializes state on open", async () => {
    const view = new InboxProcessingView(mockLeaf, testSettings);

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

    const view = new InboxProcessingView(mockLeaf, testSettings);
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
    const view = new InboxProcessingView(mockLeaf, testSettings);
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
    const view = new InboxProcessingView(mockLeaf, testSettings);
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
    const view = new InboxProcessingView(mockLeaf, testSettings);

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

    const view = new InboxProcessingView(mockLeaf, testSettings);
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
    const view = new InboxProcessingView(mockLeaf, testSettings);
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
});
