import { App, TFile } from "obsidian";
import { InboxProcessingController } from "../src/inbox-processing-controller";
import { DEFAULT_SETTINGS, FlowProject, PluginSettings } from "../src/types";
import { EditableItem } from "../src/inbox-types";
import { InboxItem } from "../src/inbox-scanner";

describe("InboxProcessingController discardInboxItem", () => {
  const createController = (
    deleteInboxItem: jest.Mock,
    settings: PluginSettings = DEFAULT_SETTINGS,
    scanProjects: jest.Mock = jest.fn()
  ) => {
    const app = new App();

    return new InboxProcessingController(app as unknown as any, settings, {
      processor: {} as any,
      scanner: { scanProjects } as any,
      personScanner: { scanPersons: jest.fn() } as any,
      writer: {} as any,
      inboxScanner: {
        deleteInboxItem,
        getAllInboxItems: jest.fn(),
      } as any,
      persistenceService: { persist: jest.fn() } as any,
    });
  };

  it("adjusts deletion offsets before removing inbox line items", async () => {
    const deleteMock = jest.fn().mockResolvedValue(undefined);
    const controller = createController(deleteMock);
    const deletionOffsets = new Map<string, number>([["path/to/file.md", 2]]);
    const sourceFile = new TFile("path/to/file.md");

    const inboxItem: InboxItem = {
      type: "line",
      content: "Example",
      sourceFile: sourceFile as unknown as any,
      lineNumber: 5,
    };

    const editableItem: EditableItem = {
      original: "Example",
      inboxItem,
      isAIProcessed: false,
      selectedAction: "next-actions-file",
      selectedSpheres: [],
    };

    await controller.discardInboxItem(editableItem, deletionOffsets);

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith(expect.objectContaining({ lineNumber: 3 }));
    expect(deletionOffsets.get("path/to/file.md")).toBe(3);
  });

  it("ignores items without inbox metadata", async () => {
    const deleteMock = jest.fn();
    const controller = createController(deleteMock);
    const deletionOffsets = new Map<string, number>();

    const editableItem: EditableItem = {
      original: "Example",
      isAIProcessed: false,
      selectedAction: "next-actions-file",
      selectedSpheres: [],
    };

    await controller.discardInboxItem(editableItem, deletionOffsets);

    expect(deleteMock).not.toHaveBeenCalled();
    expect(deletionOffsets.size).toBe(0);
  });

  it("returns only live projects when loading existing projects", async () => {
    const deleteMock = jest.fn();
    const liveProject: FlowProject = {
      file: "live.md",
      title: "Live",
      tags: ["project/personal"],
      status: "live",
      nextActions: [],
    };
    const pausedProject: FlowProject = {
      file: "paused.md",
      title: "Paused",
      tags: ["project/work"],
      status: "paused",
      nextActions: [],
    };
    const noStatusProject: FlowProject = {
      file: "nostatus.md",
      title: "No Status",
      tags: ["project/work"],
      nextActions: [],
    };

    const scanProjects = jest.fn().mockResolvedValue([liveProject, pausedProject, noStatusProject]);
    const controller = createController(deleteMock, DEFAULT_SETTINGS, scanProjects);

    const projects = await controller.loadExistingProjects();

    expect(scanProjects).toHaveBeenCalled();
    expect(projects).toEqual([liveProject, noStatusProject]);
  });
});

describe("InboxProcessingController createEditableItemsFromInbox", () => {
  const createController = (settings: PluginSettings) => {
    const app = new App();
    return new InboxProcessingController(app as unknown as any, settings, {
      scanner: { scanProjects: jest.fn() } as any,
      personScanner: { scanPersons: jest.fn() } as any,
      writer: {} as any,
      inboxScanner: {
        deleteInboxItem: jest.fn(),
        getAllInboxItems: jest.fn(),
      } as any,
      persistenceService: { persist: jest.fn() } as any,
    });
  };

  const sampleInboxItems: InboxItem[] = [
    {
      type: "line" as const,
      content: "Buy milk",
      sourceFile: { path: "inbox.md" } as any,
      lineNumber: 1,
    },
    {
      type: "line" as const,
      content: "Call dentist",
      sourceFile: { path: "inbox.md" } as any,
      lineNumber: 2,
    },
  ];

  it("auto-selects the sphere when only one sphere is configured", () => {
    const settings = { ...DEFAULT_SETTINGS, spheres: ["personal"] };
    const controller = createController(settings);

    const items = controller.createEditableItemsFromInbox(sampleInboxItems);

    expect(items[0].selectedSpheres).toEqual(["personal"]);
    expect(items[1].selectedSpheres).toEqual(["personal"]);
  });

  it("leaves spheres empty when multiple spheres are configured", () => {
    const settings = { ...DEFAULT_SETTINGS, spheres: ["personal", "work"] };
    const controller = createController(settings);

    const items = controller.createEditableItemsFromInbox(sampleInboxItems);

    expect(items[0].selectedSpheres).toEqual([]);
    expect(items[1].selectedSpheres).toEqual([]);
  });

  it("leaves spheres empty when no spheres are configured", () => {
    const settings = { ...DEFAULT_SETTINGS, spheres: [] };
    const controller = createController(settings);

    const items = controller.createEditableItemsFromInbox(sampleInboxItems);

    expect(items[0].selectedSpheres).toEqual([]);
    expect(items[1].selectedSpheres).toEqual([]);
  });
});

describe("InboxProcessingController with AI disabled", () => {
  const createControllerWithAIDisabled = () => {
    const app = new App();
    const settings: PluginSettings = {
      ...DEFAULT_SETTINGS,
      aiEnabled: false,
    };

    return new InboxProcessingController(app as unknown as any, settings, {
      scanner: { scanProjects: jest.fn().mockResolvedValue([]) } as any,
      personScanner: { scanPersons: jest.fn().mockResolvedValue([]) } as any,
      writer: {} as any,
      inboxScanner: {
        deleteInboxItem: jest.fn(),
        getAllInboxItems: jest.fn(),
      } as any,
      persistenceService: { persist: jest.fn() } as any,
    });
  };

  it("should create controller without throwing when AI is disabled", () => {
    expect(() => createControllerWithAIDisabled()).not.toThrow();
  });

  it("should still allow loading projects when AI is disabled", async () => {
    const controller = createControllerWithAIDisabled();
    const projects = await controller.loadExistingProjects();

    expect(projects).toEqual([]);
  });

  it("should still allow loading persons when AI is disabled", async () => {
    const controller = createControllerWithAIDisabled();
    const persons = await controller.loadExistingPersons();

    expect(persons).toEqual([]);
  });
});
