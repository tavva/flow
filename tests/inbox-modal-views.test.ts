// ABOUTME: Tests for inbox modal views
// ABOUTME: Tests rendering functions for inbox processing UI

/**
 * @jest-environment jsdom
 */

import { renderEditableItemContent } from "../src/inbox-modal-views";
import { InboxModalState } from "../src/inbox-modal-state";
import { EditableItem } from "../src/inbox-types";

// Mock Obsidian
jest.mock("obsidian");

// Helper to add Obsidian's createDiv and createEl methods to an HTMLElement
function makeObsidianElement(el: HTMLElement): HTMLElement {
  (el as any).createDiv = function (cls?: string) {
    const div = document.createElement("div");
    if (cls) div.className = cls;
    this.appendChild(div);
    return makeObsidianElement(div);
  };
  (el as any).createEl = function (tag: string, options?: { cls?: string; text?: string }) {
    const element = document.createElement(tag);
    if (options?.cls) element.className = options.cls;
    if (options?.text) element.textContent = options.text;
    this.appendChild(element);
    return makeObsidianElement(element);
  };
  (el as any).createSpan = function (options?: { cls?: string; text?: string }) {
    const span = document.createElement("span");
    if (options?.cls) span.className = options.cls;
    if (options?.text) span.textContent = options.text;
    this.appendChild(span);
    return makeObsidianElement(span);
  };
  (el as any).addClass = function (cls: string) {
    this.classList.add(cls);
    return this;
  };
  (el as any).setText = function (text: string) {
    this.textContent = text;
    return this;
  };
  (el as any).empty = function () {
    this.innerHTML = "";
    return this;
  };
  return el;
}

// Helper to create mock state
function createMockState(editableItems: EditableItem[]): InboxModalState {
  const mockController = {} as any;
  const mockSettings = {
    availableSpheres: ["personal", "work"],
    spheres: ["personal", "work"],
    defaultPriority: 2,
    defaultStatus: "live",
  } as any;
  const mockRenderCallback = jest.fn();

  const state = new InboxModalState(mockController, mockSettings, mockRenderCallback);
  state.editableItems = editableItems;
  state.queueRender = jest.fn();
  state.existingProjects = [];
  state.existingPersons = [];
  return state;
}

describe("renderEditableItemContent - action button groups", () => {
  it("renders action buttons in three groups with headers", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      isAIProcessed: false,
      selectedAction: "next-actions-file",
      selectedSpheres: [],
    };
    const state = createMockState([item]);

    renderEditableItemContent(container, item, state);

    // Should have action groups container
    const groupsContainer = container.querySelector(".flow-gtd-action-groups");
    expect(groupsContainer).toBeTruthy();

    // Should have three groups
    const groups = container.querySelectorAll(".flow-gtd-action-group");
    expect(groups.length).toBe(3);

    // Should have group headers
    const headers = container.querySelectorAll(".flow-gtd-action-group-header");
    expect(headers.length).toBe(3);
    expect(headers[0].textContent).toBe("Projects");
    expect(headers[1].textContent).toBe("Actions");
    expect(headers[2].textContent).toBe("Other");

    // Projects group should have 3 buttons
    const projectsButtons = groups[0].querySelectorAll(".flow-gtd-action-button");
    expect(projectsButtons.length).toBe(3);
    expect(projectsButtons[0].textContent).toContain("Create");
    expect(projectsButtons[1].textContent).toContain("Add");
    expect(projectsButtons[2].textContent).toContain("Reference");

    // Actions group should have 2 buttons
    const actionsButtons = groups[1].querySelectorAll(".flow-gtd-action-button");
    expect(actionsButtons.length).toBe(2);
    expect(actionsButtons[0].textContent).toContain("Next");
    expect(actionsButtons[1].textContent).toContain("Someday");

    // Other group should have 2 buttons
    const otherButtons = groups[2].querySelectorAll(".flow-gtd-action-button");
    expect(otherButtons.length).toBe(2);
    expect(otherButtons[0].textContent).toContain("Person");
    expect(otherButtons[1].textContent).toContain("Trash");
  });

  it("marks selected action button with 'selected' class", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      isAIProcessed: false,
      selectedAction: "create-project",
      selectedSpheres: [],
    };
    const state = createMockState([item]);

    renderEditableItemContent(container, item, state);

    const allButtons = container.querySelectorAll(".flow-gtd-action-button");
    const selectedButtons = container.querySelectorAll(".flow-gtd-action-button.selected");

    // Only one button should be selected
    expect(selectedButtons.length).toBe(1);

    // The create-project button should be selected
    const createButton = Array.from(allButtons).find((btn) => btn.textContent?.includes("Create"));
    expect(createButton?.classList.contains("selected")).toBe(true);
  });

  it("calls state.queueRender when action button clicked", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      isAIProcessed: false,
      selectedAction: "next-actions-file",
      selectedSpheres: [],
    };
    const state = createMockState([item]);

    renderEditableItemContent(container, item, state);

    const somedayButton = Array.from(container.querySelectorAll(".flow-gtd-action-button")).find(
      (btn) => btn.textContent?.includes("Someday")
    ) as HTMLButtonElement;

    expect(somedayButton).toBeTruthy();
    somedayButton.click();

    expect(item.selectedAction).toBe("someday-file");
    expect(state.queueRender).toHaveBeenCalledWith("editable");
  });

  it("defaults to 'next-actions-file' when selectedAction is undefined", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      isAIProcessed: false,
      selectedAction: undefined as any,
      selectedSpheres: [],
    };
    const state = createMockState([item]);

    renderEditableItemContent(container, item, state);

    const allButtons = container.querySelectorAll(".flow-gtd-action-button");
    const nextButton = Array.from(allButtons).find((btn) => btn.textContent?.includes("Next"));

    // Should default to next-actions-file
    expect(nextButton?.classList.contains("selected")).toBe(true);
  });
});

describe("renderEditableItemContent - date section", () => {
  it("should render collapsible date section", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      isAIProcessed: true,
      selectedAction: "next-actions-file",
      selectedSpheres: ["work"],
      editedName: "Test action",
      editedNames: ["Test action"],
      waitingFor: [false],
    };
    const state = createMockState([item]);

    renderEditableItemContent(container, item, state);

    const dateSection = container.querySelector(".flow-gtd-date-section");
    expect(dateSection).toBeTruthy();

    const dateLabel = dateSection?.querySelector(".flow-gtd-date-label");
    expect(dateLabel?.textContent).toContain("Set due date (optional)");
  });

  it("should show different date labels based on action type", () => {
    const actionLabels: Record<string, string | null> = {
      "next-actions-file": "Set due date (optional)",
      "create-project": "Set target date (optional)",
      "someday-file": "Set reminder date (optional)",
      person: "Set follow-up date (optional)",
      reference: null,
    };

    Object.entries(actionLabels).forEach(([action, expectedLabel]) => {
      const container = makeObsidianElement(document.createElement("div"));
      const item: EditableItem = {
        original: "Test",
        isAIProcessed: true,
        selectedAction: action as any,
        selectedSpheres: ["work"],
        editedName: "Test",
      };
      const state = createMockState([item]);

      renderEditableItemContent(container, item, state);

      const dateSection = container.querySelector(".flow-gtd-date-section") as HTMLElement;

      if (expectedLabel) {
        expect(dateSection).toBeTruthy();
        expect(dateSection.style.display).not.toBe("none");
        const label = dateSection.querySelector(".flow-gtd-date-label");
        expect(label?.textContent).toBe(expectedLabel);
      } else {
        expect(dateSection).toBeNull();
      }
    });
  });
});
