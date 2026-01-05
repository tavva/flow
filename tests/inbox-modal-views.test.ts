// ABOUTME: Tests for inbox modal views
// ABOUTME: Tests rendering functions for inbox processing UI

/**
 * @jest-environment jsdom
 */

import { renderEditableItemsView, renderInboxView } from "../src/inbox-modal-views";
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
  (el as any).appendText = function (text: string) {
    this.appendChild(document.createTextNode(text));
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

describe("renderInboxView", () => {
  it("renders loading state", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const state = createMockState([]);

    renderInboxView(container, state, { isLoading: true });

    expect(container.textContent).toContain("Loading inbox");
  });

  it("renders empty state when not loading and no items", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const state = createMockState([]);

    renderInboxView(container, state, { isLoading: false });

    const emptyState = container.querySelector(".flow-inbox-empty-state");
    expect(emptyState).toBeTruthy();
    expect(emptyState?.textContent).toContain("inbox is empty");
  });
});

describe("renderEditableItemsView", () => {
  it("renders completion state when all items processed", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const state = createMockState([]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const completionEl = container.querySelector(".flow-inbox-completion");
    expect(completionEl).toBeTruthy();
    expect(completionEl?.textContent).toContain("All items processed");
  });

  it("renders navigation header with item count", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const header = container.querySelector(".flow-inbox-header");
    expect(header).toBeTruthy();
    expect(header?.textContent).toContain("1 of 1");
  });

  it("renders original content box", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item content",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const originalBox = container.querySelector(".flow-inbox-original");
    expect(originalBox).toBeTruthy();
    expect(originalBox?.textContent).toContain("Test item content");
  });

  it("renders type selector with three options", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const typeSelector = container.querySelector(".flow-inbox-type-selector");
    expect(typeSelector).toBeTruthy();

    const typeButtons = typeSelector?.querySelectorAll(".flow-inbox-type-btn");
    expect(typeButtons?.length).toBe(3);

    const buttonTexts = Array.from(typeButtons || []).map((btn) => btn.textContent);
    expect(buttonTexts).toContain("⚡ Next");
    expect(buttonTexts).toContain("💭 Someday");
    expect(buttonTexts).toContain("📄 Ref");
  });

  it("marks correct type button as selected", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "someday-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const selectedBtn = container.querySelector(".flow-inbox-type-btn.selected");
    expect(selectedBtn).toBeTruthy();
    expect(selectedBtn?.textContent).toContain("Someday");
  });

  it("renders actions section for next action type", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const actionsSection = container.querySelector(".flow-inbox-actions-section");
    expect(actionsSection).toBeTruthy();

    const actionsList = container.querySelector(".flow-inbox-actions-list");
    expect(actionsList).toBeTruthy();
  });

  it("hides actions section for reference type", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "reference",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const actionsSection = container.querySelector(".flow-inbox-actions-section");
    expect(actionsSection).toBeNull();
  });

  it("renders project section for next action type", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const projectSection = container.querySelector(".flow-inbox-project-section");
    expect(projectSection).toBeTruthy();
  });

  it("hides project section for someday type", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "someday-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const projectSection = container.querySelector(".flow-inbox-project-section");
    expect(projectSection).toBeNull();
  });

  it("renders sphere toggle buttons", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const sphereSection = container.querySelector(".flow-inbox-sphere-section");
    expect(sphereSection).toBeTruthy();

    const sphereButtons = sphereSection?.querySelectorAll(".flow-inbox-sphere-btn");
    expect(sphereButtons?.length).toBe(2);
  });

  it("marks selected spheres", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: ["work"],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const selectedBtn = container.querySelector(".flow-inbox-sphere-btn.selected");
    expect(selectedBtn).toBeTruthy();
    expect(selectedBtn?.textContent?.toLowerCase()).toContain("work");
  });

  it("renders due date section", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const dueSection = container.querySelector(".flow-inbox-due-section");
    expect(dueSection).toBeTruthy();

    const dueInput = dueSection?.querySelector(".flow-inbox-due-input");
    expect(dueInput).toBeTruthy();
    expect((dueInput as HTMLInputElement)?.type).toBe("date");
  });

  it("renders bottom bar with delete and save buttons", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const bottomBar = container.querySelector(".flow-inbox-bottom-bar");
    expect(bottomBar).toBeTruthy();

    const deleteBtn = container.querySelector(".flow-inbox-delete-btn");
    expect(deleteBtn).toBeTruthy();

    const saveBtn = container.querySelector(".flow-inbox-save-btn");
    expect(saveBtn).toBeTruthy();
    expect(saveBtn?.textContent).toContain("Save");
  });

  it("shows action count in save button", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
      editedNames: ["Action 1", "Action 2"],
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const saveBtn = container.querySelector(".flow-inbox-save-btn");
    expect(saveBtn?.textContent).toContain("2 actions");
  });
});

describe("type selector interactions", () => {
  it("updates selectedAction when type button clicked", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const somedayBtn = Array.from(container.querySelectorAll(".flow-inbox-type-btn")).find((btn) =>
      btn.textContent?.includes("Someday")
    ) as HTMLButtonElement;

    expect(somedayBtn).toBeTruthy();
    somedayBtn.click();

    expect(item.selectedAction).toBe("someday-file");
    expect(state.queueRender).toHaveBeenCalledWith("editable");
  });

  it("updates selectedAction to reference when Ref clicked", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const refBtn = Array.from(container.querySelectorAll(".flow-inbox-type-btn")).find((btn) =>
      btn.textContent?.includes("Ref")
    ) as HTMLButtonElement;

    expect(refBtn).toBeTruthy();
    refBtn.click();

    expect(item.selectedAction).toBe("reference");
    expect(state.queueRender).toHaveBeenCalledWith("editable");
  });
});

describe("actions section interactions", () => {
  it("initializes action input with original content", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Original task text",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const actionInput = container.querySelector(".flow-inbox-action-input") as HTMLInputElement;
    expect(actionInput).toBeTruthy();
    expect(actionInput.value).toBe("Original task text");
  });

  it("renders action control buttons (waiting, focus, done)", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const controls = container.querySelector(".flow-inbox-action-controls");
    expect(controls).toBeTruthy();

    const waitingBtn = controls?.querySelector(".waiting-btn");
    expect(waitingBtn).toBeTruthy();
    expect(waitingBtn?.textContent).toContain("🤝");

    const focusBtn = controls?.querySelector(".focus-btn");
    expect(focusBtn).toBeTruthy();

    const doneBtn = controls?.querySelector(".done-btn");
    expect(doneBtn).toBeTruthy();
    expect(doneBtn?.textContent).toContain("✓");
  });

  it("toggles waiting state when waiting button clicked", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const waitingBtn = container.querySelector(".waiting-btn") as HTMLButtonElement;
    expect(waitingBtn).toBeTruthy();

    waitingBtn.click();

    expect(item.waitingFor?.[0]).toBe(true);
    expect(state.queueRender).toHaveBeenCalledWith("editable");
  });

  it("toggles done state when done button clicked", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const doneBtn = container.querySelector(".done-btn") as HTMLButtonElement;
    expect(doneBtn).toBeTruthy();

    doneBtn.click();

    expect(item.markAsDone?.[0]).toBe(true);
    expect(state.queueRender).toHaveBeenCalledWith("editable");
  });

  it("renders add action button", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const addBtn = container.querySelector(".flow-inbox-add-action-btn");
    expect(addBtn).toBeTruthy();
    expect(addBtn?.textContent).toContain("Add action");
  });
});

describe("sphere toggle interactions", () => {
  it("toggles sphere selection when button clicked", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const workBtn = Array.from(container.querySelectorAll(".flow-inbox-sphere-btn")).find((btn) =>
      btn.textContent?.toLowerCase().includes("work")
    ) as HTMLButtonElement;

    expect(workBtn).toBeTruthy();
    workBtn.click();

    expect(item.selectedSpheres).toContain("work");
    expect(state.queueRender).toHaveBeenCalledWith("editable");
  });

  it("deselects sphere when already selected", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: ["work"],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const workBtn = Array.from(container.querySelectorAll(".flow-inbox-sphere-btn")).find((btn) =>
      btn.textContent?.toLowerCase().includes("work")
    ) as HTMLButtonElement;

    expect(workBtn).toBeTruthy();
    workBtn.click();

    expect(item.selectedSpheres).not.toContain("work");
    expect(state.queueRender).toHaveBeenCalledWith("editable");
  });
});

describe("person in combined project/person dropdown", () => {
  it("shows selected person with emoji in project input", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const selectedPerson = { file: "people/John.md", title: "John", tags: ["person"] };
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "person",
      selectedSpheres: [],
      selectedPerson,
      isExpanded: true,
    };
    const state = createMockState([item]);
    state.existingPersons = [selectedPerson];
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    // Person should show in project input with emoji
    const projectInput = container.querySelector(".flow-inbox-project-input") as HTMLInputElement;
    expect(projectInput).toBeTruthy();
    expect(projectInput.value).toBe("👤 John");
  });

  it("renders person action correctly when selectedAction is person", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const john = { file: "people/John.md", title: "John", tags: ["person"] };
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "person",
      selectedSpheres: [],
      selectedPerson: john,
      isExpanded: true,
    };
    const state = createMockState([item]);
    state.existingPersons = [john];
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    // Project section should be visible (now combined with person)
    const projectSection = container.querySelector(".flow-inbox-project-section");
    expect(projectSection).toBeTruthy();

    // Input should show selected person with emoji
    const projectInput = container.querySelector(".flow-inbox-project-input") as HTMLInputElement;
    expect(projectInput.value).toBe("👤 John");

    // Type selector should show "Next" as selected (person maps to next)
    const selectedBtn = container.querySelector(".flow-inbox-type-btn.selected");
    expect(selectedBtn?.textContent).toContain("Next");
  });

  it("includes persons in project dropdown", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    state.existingPersons = [
      { file: "people/Alice.md", title: "Alice", tags: ["person"] },
      { file: "people/Bob.md", title: "Bob", tags: ["person"] },
    ];
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    // Project dropdown should exist (combined with persons)
    const dropdown = container.querySelector(".flow-inbox-project-dropdown");
    expect(dropdown).toBeTruthy();
  });
});

describe("priority section for new projects", () => {
  it("renders priority section when creating new project", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "create-project",
      selectedSpheres: [],
      isExpanded: true,
      editedProjectTitle: "New Project",
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const prioritySection = container.querySelector(".flow-inbox-priority-section");
    expect(prioritySection).toBeTruthy();

    const priorityButtons = prioritySection?.querySelectorAll(".flow-inbox-priority-btn");
    expect(priorityButtons?.length).toBe(5);
  });

  it("hides priority section for non-project actions", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const prioritySection = container.querySelector(".flow-inbox-priority-section");
    expect(prioritySection).toBeNull();
  });

  it("initializes priority from settings default", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "create-project",
      selectedSpheres: [],
      isExpanded: true,
      editedProjectTitle: "New Project",
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    // Default priority is 2 in mock settings
    expect(item.projectPriority).toBe(2);

    const selectedBtn = container.querySelector(".flow-inbox-priority-btn.selected");
    expect(selectedBtn).toBeTruthy();
    expect(selectedBtn?.textContent).toBe("2");
  });

  it("updates priority when button clicked", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "create-project",
      selectedSpheres: [],
      isExpanded: true,
      editedProjectTitle: "New Project",
      projectPriority: 2,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    // Click priority 4 button
    const priorityButtons = container.querySelectorAll(".flow-inbox-priority-btn");
    const priority4Btn = Array.from(priorityButtons).find(
      (btn) => btn.textContent === "4"
    ) as HTMLButtonElement;

    expect(priority4Btn).toBeTruthy();
    priority4Btn.click();

    expect(item.projectPriority).toBe(4);
    expect(state.queueRender).toHaveBeenCalledWith("editable");
  });

  it("marks current priority as selected", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "create-project",
      selectedSpheres: [],
      isExpanded: true,
      editedProjectTitle: "New Project",
      projectPriority: 3,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const selectedBtn = container.querySelector(".flow-inbox-priority-btn.selected");
    expect(selectedBtn).toBeTruthy();
    expect(selectedBtn?.textContent).toBe("3");
  });
});

describe("navigation", () => {
  it("renders navigation arrows", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const arrows = container.querySelector(".flow-inbox-arrows");
    expect(arrows).toBeTruthy();

    const arrowButtons = arrows?.querySelectorAll(".flow-inbox-arrow-btn");
    expect(arrowButtons?.length).toBe(2);
  });

  it("disables prev button on first item", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const prevBtn = container.querySelector(".flow-inbox-arrow-btn") as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);
  });

  it("disables next button on last item", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const item: EditableItem = {
      original: "Test item",
      selectedAction: "next-actions-file",
      selectedSpheres: [],
      isExpanded: true,
    };
    const state = createMockState([item]);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const arrowButtons = container.querySelectorAll(".flow-inbox-arrow-btn");
    const nextBtn = arrowButtons[1] as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
  });

  it("enables both arrows when multiple items", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const items: EditableItem[] = [
      {
        original: "Item 1",
        selectedAction: "next-actions-file",
        selectedSpheres: [],
        isExpanded: false,
      },
      {
        original: "Item 2",
        selectedAction: "next-actions-file",
        selectedSpheres: [],
        isExpanded: true,
      },
      {
        original: "Item 3",
        selectedAction: "next-actions-file",
        selectedSpheres: [],
        isExpanded: false,
      },
    ];
    const state = createMockState(items);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const arrowButtons = container.querySelectorAll(".flow-inbox-arrow-btn");
    const prevBtn = arrowButtons[0] as HTMLButtonElement;
    const nextBtn = arrowButtons[1] as HTMLButtonElement;

    // Item 2 is active (index 1), so both arrows should be enabled
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(false);
  });

  it("shows correct count for current item", () => {
    const container = makeObsidianElement(document.createElement("div"));
    const items: EditableItem[] = [
      {
        original: "Item 1",
        selectedAction: "next-actions-file",
        selectedSpheres: [],
        isExpanded: false,
      },
      {
        original: "Item 2",
        selectedAction: "next-actions-file",
        selectedSpheres: [],
        isExpanded: true,
      },
      {
        original: "Item 3",
        selectedAction: "next-actions-file",
        selectedSpheres: [],
        isExpanded: false,
      },
    ];
    const state = createMockState(items);
    const onClose = jest.fn();

    renderEditableItemsView(container, state, { onClose });

    const countSpan = container.querySelector(".flow-inbox-count");
    expect(countSpan?.textContent).toContain("2 of 3");
  });
});
