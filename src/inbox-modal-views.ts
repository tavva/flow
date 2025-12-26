// ABOUTME: Renders the redesigned inbox processing view with single-item card layout
// ABOUTME: Provides type selector, editable actions list, project/sphere/date fields

import { Setting } from "obsidian";
import { InboxModalState } from "./inbox-modal-state";
import { EditableItem } from "./inbox-types";
import { FlowProject } from "./types";

export interface EditableItemsViewOptions {
  onClose: () => void;
}

export interface InboxViewOptions {
  isLoading?: boolean;
}

export function renderInboxView(
  contentEl: HTMLElement,
  state: InboxModalState,
  options: InboxViewOptions = {}
) {
  const { isLoading = true } = options;

  contentEl.empty();
  contentEl.addClass("flow-gtd-inbox-modal");

  if (isLoading) {
    const loadingContainer = contentEl.createDiv("flow-inbox-redesign");
    loadingContainer.style.textAlign = "center";
    loadingContainer.style.padding = "48px 24px";
    loadingContainer.style.display = "flex";
    loadingContainer.style.flexDirection = "column";
    loadingContainer.style.alignItems = "center";
    loadingContainer.style.justifyContent = "center";
    loadingContainer.style.minHeight = "200px";

    const loadingText = loadingContainer.createEl("div");
    loadingText.style.color = "var(--text-muted)";
    loadingText.setText("Loading inbox...");
    return;
  }

  // Empty state when no items
  const emptyStateContainer = contentEl.createDiv("flow-inbox-redesign");
  const emptyState = emptyStateContainer.createDiv("flow-inbox-empty-state");

  const emptyIcon = emptyState.createEl("div", { cls: "flow-inbox-empty-icon" });
  emptyIcon.setText("✨");

  emptyState.createEl("h3", {
    text: "Your inbox is empty!",
    cls: "flow-inbox-empty-title",
  });

  const emptyDescription = emptyState.createEl("p", { cls: "flow-inbox-empty-description" });
  emptyDescription.setText(
    "No items found in your Flow inbox folders. Add files to process in your inbox folders, or close this window."
  );
}

export function renderEditableItemsView(
  contentEl: HTMLElement,
  state: InboxModalState,
  { onClose }: EditableItemsViewOptions
) {
  contentEl.empty();
  contentEl.addClass("flow-gtd-inbox-modal");

  // Completion state
  if (state.editableItems.length === 0) {
    const container = contentEl.createDiv("flow-inbox-redesign");
    const completionEl = container.createDiv("flow-inbox-completion");
    completionEl.createEl("h3", { text: "🎉 All items processed!" });
    completionEl.createEl("p", { text: "Your inbox is now empty." });

    new Setting(completionEl).addButton((button) =>
      button.setButtonText("Close").setCta().onClick(onClose)
    );
    return;
  }

  // Get current item (the expanded one, or first if none expanded)
  const currentIndex = state.editableItems.findIndex((item) => item.isExpanded);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentItem = state.editableItems[activeIndex];

  // Ensure the current item is marked as expanded
  if (currentIndex < 0 && state.editableItems.length > 0) {
    state.editableItems[0].isExpanded = true;
  }

  const container = contentEl.createDiv("flow-inbox-redesign");

  // Navigation header
  renderNavigationHeader(container, state, activeIndex);

  // Original item display
  renderOriginalBox(container, currentItem);

  // Type selector (Next, Someday, Ref)
  renderTypeSelector(container, currentItem, state);

  // Actions section (only for actionable types)
  if (shouldShowActionsSection(currentItem)) {
    renderActionsSection(container, currentItem, state);
  }

  // Project section (only for Next action type)
  if (shouldShowProjectSection(currentItem)) {
    renderProjectSection(container, currentItem, state);
  }

  // Sphere toggle (for types that need sphere)
  if (shouldShowSphereSelector(currentItem)) {
    renderSphereToggle(container, currentItem, state);
  }

  // Due date section
  if (shouldShowDueDate(currentItem)) {
    renderDueDateSection(container, currentItem);
  }

  // Bottom bar with delete and save buttons
  renderBottomBar(container, currentItem, state);
}

function renderNavigationHeader(
  container: HTMLElement,
  state: InboxModalState,
  currentIndex: number
) {
  const header = container.createDiv("flow-inbox-header");

  const countSpan = header.createSpan({ cls: "flow-inbox-count" });
  countSpan.setText(`Inbox · ${currentIndex + 1} of ${state.editableItems.length}`);

  const arrows = header.createDiv("flow-inbox-arrows");

  const prevBtn = arrows.createEl("button", { cls: "flow-inbox-arrow-btn" });
  prevBtn.setText("←");
  prevBtn.disabled = currentIndex === 0;
  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      navigateToItem(state, currentIndex - 1);
    }
  });

  const nextBtn = arrows.createEl("button", { cls: "flow-inbox-arrow-btn" });
  nextBtn.setText("→");
  nextBtn.disabled = currentIndex === state.editableItems.length - 1;
  nextBtn.addEventListener("click", () => {
    if (currentIndex < state.editableItems.length - 1) {
      navigateToItem(state, currentIndex + 1);
    }
  });
}

function navigateToItem(state: InboxModalState, targetIndex: number) {
  state.editableItems.forEach((item, i) => {
    item.isExpanded = i === targetIndex;
  });
  state.queueRender("editable");
}

function renderOriginalBox(container: HTMLElement, item: EditableItem) {
  const originalBox = container.createDiv("flow-inbox-original");

  const label = originalBox.createDiv("flow-inbox-original-label");
  label.setText("ORIGINAL");

  const heading = originalBox.createEl("h1");
  heading.setText(item.original);
}

type SimplifiedAction = "next" | "someday" | "reference";

function getSimplifiedAction(item: EditableItem): SimplifiedAction {
  switch (item.selectedAction) {
    case "create-project":
    case "add-to-project":
    case "next-actions-file":
    case "person":
      return "next";
    case "someday-file":
      return "someday";
    case "reference":
    case "trash":
      return "reference";
    default:
      return "next";
  }
}

function setActionFromSimplified(item: EditableItem, simplified: SimplifiedAction) {
  switch (simplified) {
    case "next":
      item.selectedAction = "next-actions-file";
      break;
    case "someday":
      item.selectedAction = "someday-file";
      break;
    case "reference":
      item.selectedAction = "reference";
      break;
  }
}

function renderTypeSelector(container: HTMLElement, item: EditableItem, state: InboxModalState) {
  const typeSelector = container.createDiv("flow-inbox-type-selector");

  const types: { value: SimplifiedAction; label: string }[] = [
    { value: "next", label: "⚡ Next" },
    { value: "someday", label: "💭 Someday" },
    { value: "reference", label: "📄 Ref" },
  ];

  const currentSimplified = getSimplifiedAction(item);

  types.forEach((type) => {
    const btn = typeSelector.createEl("button", { cls: "flow-inbox-type-btn" });
    btn.setText(type.label);

    if (type.value === currentSimplified) {
      btn.addClass("selected");
    }

    btn.addEventListener("click", () => {
      setActionFromSimplified(item, type.value);
      state.queueRender("editable");
    });
  });
}

function shouldShowActionsSection(item: EditableItem): boolean {
  const simplified = getSimplifiedAction(item);
  return simplified === "next" || simplified === "someday";
}

function shouldShowProjectSection(item: EditableItem): boolean {
  return getSimplifiedAction(item) === "next";
}

function shouldShowSphereSelector(item: EditableItem): boolean {
  const simplified = getSimplifiedAction(item);
  return simplified === "next" || simplified === "someday";
}

function shouldShowDueDate(item: EditableItem): boolean {
  const simplified = getSimplifiedAction(item);
  return simplified === "next" || simplified === "someday";
}

function renderActionsSection(container: HTMLElement, item: EditableItem, state: InboxModalState) {
  // Initialize actions array
  let currentActions: string[] = [];
  if (item.editedNames && item.editedNames.length > 0) {
    currentActions = [...item.editedNames];
  } else if (item.editedName) {
    currentActions = [item.editedName];
  } else {
    currentActions = [item.original];
  }

  // Initialize tracking arrays
  if (!item.waitingFor) {
    item.waitingFor = new Array(currentActions.length).fill(false);
  }
  while (item.waitingFor.length < currentActions.length) {
    item.waitingFor.push(false);
  }

  if (!item.markAsDone) {
    item.markAsDone = new Array(currentActions.length).fill(false);
  }
  while (item.markAsDone.length < currentActions.length) {
    item.markAsDone.push(false);
  }

  // Initialize addToFocus array
  if (!item.addToFocus) {
    item.addToFocus = new Array(currentActions.length).fill(false);
  }
  while (item.addToFocus.length < currentActions.length) {
    item.addToFocus.push(false);
  }

  const section = container.createDiv("flow-inbox-actions-section");

  // Header with count
  const header = section.createDiv("flow-inbox-section-header");
  const labelSpan = header.createSpan({ cls: "label" });
  labelSpan.setText("ACTIONS");

  const countSpan = header.createSpan({ cls: "flow-inbox-action-count" });
  const activeCount = currentActions.filter((_, i) => !item.markAsDone![i]).length;
  countSpan.setText(String(activeCount));

  // Actions list
  const actionsList = section.createDiv("flow-inbox-actions-list");

  currentActions.forEach((actionText, index) => {
    const actionItem = actionsList.createDiv("flow-inbox-action-item");

    // Apply state classes
    if (item.waitingFor![index]) {
      actionItem.addClass("waiting");
    }
    if (item.addToFocus![index]) {
      actionItem.addClass("focused");
    }
    if (item.markAsDone![index]) {
      actionItem.addClass("done");
    }

    // Input field
    const input = actionItem.createEl("input", { cls: "flow-inbox-action-input" });
    input.type = "text";
    input.value = actionText;
    input.placeholder = "Action...";

    input.addEventListener("input", () => {
      currentActions[index] = input.value;
      item.editedNames = [...currentActions];
      if (currentActions.length === 1) {
        item.editedName = currentActions[0];
      }
      updateAddButtonState();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!hasEmptyAction()) {
          addNewAction();
        }
      }
      if (e.key === "Backspace" && input.value === "" && currentActions.length > 1) {
        e.preventDefault();
        removeAction(index);
      }

      // Ctrl + W: toggle waiting for
      if (e.key.toLowerCase() === "w" && e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        item.waitingFor![index] = !item.waitingFor![index];
        state.queueRender("editable");
      }

      // Ctrl + F: toggle focus
      if (e.key.toLowerCase() === "f" && e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        item.addToFocus![index] = !item.addToFocus![index];
        if (item.addToFocus![index]) {
          item.markAsDone![index] = false;
        }
        state.queueRender("editable");
      }

      // Ctrl + D: toggle done
      if (e.key.toLowerCase() === "d" && e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        item.markAsDone![index] = !item.markAsDone![index];
        if (item.markAsDone![index]) {
          item.addToFocus![index] = false;
        }
        state.queueRender("editable");
      }
    });

    // Control buttons
    const controls = actionItem.createDiv("flow-inbox-action-controls");

    // Waiting button
    const waitingBtn = controls.createEl("button", { cls: "flow-inbox-action-ctrl waiting-btn" });
    waitingBtn.setText("🤝");
    waitingBtn.title = "Waiting for";
    if (item.waitingFor![index]) {
      waitingBtn.addClass("active");
    }
    waitingBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      item.waitingFor![index] = !item.waitingFor![index];
      state.queueRender("editable");
    });

    // Focus button
    const focusBtn = controls.createEl("button", { cls: "flow-inbox-action-ctrl focus-btn" });
    focusBtn.setText("◉");
    focusBtn.title = "Add to focus";
    if (item.addToFocus![index]) {
      focusBtn.addClass("active");
    }
    focusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      item.addToFocus![index] = !item.addToFocus![index];
      // If enabling focus, disable done for this action
      if (item.addToFocus![index] && item.markAsDone![index]) {
        item.markAsDone![index] = false;
      }
      state.queueRender("editable");
    });

    // Done button
    const doneBtn = controls.createEl("button", { cls: "flow-inbox-action-ctrl done-btn" });
    doneBtn.setText("✓");
    doneBtn.title = "Mark as done";
    if (item.markAsDone![index]) {
      doneBtn.addClass("active");
    }
    doneBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      item.markAsDone![index] = !item.markAsDone![index];
      // If enabling done, disable focus for this action
      if (item.markAsDone![index] && item.addToFocus![index]) {
        item.addToFocus![index] = false;
      }
      state.queueRender("editable");
    });

    // Remove button
    const removeBtn = actionItem.createEl("button", { cls: "flow-inbox-remove-action" });
    removeBtn.setText("×");
    removeBtn.title = "Remove";
    removeBtn.disabled = currentActions.length === 1;

    if (currentActions.length > 1) {
      removeBtn.addEventListener("click", () => {
        removeAction(index);
      });
    }
  });

  // Add action button
  const addBtn = actionsList.createEl("button", { cls: "flow-inbox-add-action-btn" });
  addBtn.setText("+ Add action");

  const hasEmptyAction = () => currentActions.some((a) => a.trim() === "");
  const updateAddButtonState = () => {
    addBtn.disabled = hasEmptyAction();
  };
  updateAddButtonState();

  const addNewAction = () => {
    currentActions.push("");
    item.editedNames = [...currentActions];
    item.waitingFor!.push(false);
    item.markAsDone!.push(false);
    item.addToFocus!.push(false);
    // Mark which action to focus after render
    (item as any).pendingFocusActionIndex = currentActions.length - 1;
    state.queueRender("editable");
  };

  const removeAction = (index: number) => {
    currentActions.splice(index, 1);
    item.editedNames = [...currentActions];
    item.waitingFor!.splice(index, 1);
    item.markAsDone!.splice(index, 1);
    item.addToFocus!.splice(index, 1);
    if (currentActions.length === 1) {
      item.editedName = currentActions[0];
    }
    state.queueRender("editable");
  };

  addBtn.addEventListener("click", () => {
    if (!hasEmptyAction()) {
      addNewAction();
    }
  });

  // Focus pending action input after render
  const pendingIndex = (item as any).pendingFocusActionIndex;
  if (pendingIndex !== undefined) {
    delete (item as any).pendingFocusActionIndex;
    const inputs = actionsList.querySelectorAll(".flow-inbox-action-input");
    const targetInput = inputs[pendingIndex] as HTMLInputElement | undefined;
    if (targetInput) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => targetInput.focus(), 0);
    }
  }
}

function renderProjectSection(container: HTMLElement, item: EditableItem, state: InboxModalState) {
  const section = container.createDiv("flow-inbox-project-section");
  const row = section.createDiv("flow-inbox-project-row");

  const labelSpan = row.createSpan({ cls: "label" });
  labelSpan.setText(item.selectedAction === "create-project" ? "NEW PROJECT" : "PROJECT");

  const inputWrapper = row.createDiv();
  inputWrapper.style.flex = "1";
  inputWrapper.style.position = "relative";

  const input = inputWrapper.createEl("input", { cls: "flow-inbox-project-input" });
  input.type = "text";
  input.placeholder = "None";
  // Show project title or new project name being created
  input.value =
    item.selectedAction === "create-project"
      ? item.editedProjectTitle || ""
      : item.selectedProject?.title || "";

  const dropdown = inputWrapper.createDiv("flow-inbox-project-dropdown");
  dropdown.style.display = "none";

  const updateDropdown = (searchTerm: string) => {
    dropdown.empty();

    const filtered = searchTerm
      ? state.existingProjects.filter((p) =>
          p.title.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : state.existingProjects;

    // Sort by most recently modified
    const sorted = [...filtered].sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

    sorted.slice(0, 10).forEach((project) => {
      const projectBtn = dropdown.createEl("button", { cls: "flow-inbox-project-dropdown-item" });
      projectBtn.setText(project.title);

      if (item.selectedProject?.file === project.file) {
        projectBtn.addClass("selected");
      }

      projectBtn.addEventListener("click", () => {
        selectProject(project);
      });
    });

    // Add "Create new project" option when there's a search term
    if (searchTerm.trim()) {
      const createBtn = dropdown.createEl("button", {
        cls: "flow-inbox-project-dropdown-item create-new",
      });
      createBtn.setText(`+ Create "${searchTerm.trim()}"`);

      if (item.selectedAction === "create-project") {
        createBtn.addClass("selected");
      }

      createBtn.addEventListener("click", () => {
        item.selectedProject = undefined;
        item.editedProjectTitle = searchTerm.trim();
        item.selectedAction = "create-project";
        input.value = searchTerm.trim();
        dropdown.style.display = "none";
        state.queueRender("editable");
      });
    }

    if (sorted.length === 0 && !searchTerm.trim()) {
      dropdown.style.display = "none";
      return;
    }

    dropdown.style.display = "block";
  };

  const selectProject = (project: FlowProject | undefined) => {
    item.selectedProject = project;
    input.value = project?.title || "";
    dropdown.style.display = "none";

    // When a project is selected, change action to add-to-project
    if (project) {
      item.selectedAction = "add-to-project";
    } else {
      item.selectedAction = "next-actions-file";
    }
  };

  input.addEventListener("input", () => {
    updateDropdown(input.value);

    // If input is cleared, deselect project
    if (input.value.trim() === "") {
      item.selectedProject = undefined;
      item.selectedAction = "next-actions-file";
    }
  });

  input.addEventListener("focus", () => {
    updateDropdown(input.value);
  });

  input.addEventListener("blur", () => {
    // Delay to allow click on dropdown item
    setTimeout(() => {
      dropdown.style.display = "none";
    }, 200);
  });
}

function renderSphereToggle(container: HTMLElement, item: EditableItem, state: InboxModalState) {
  const spheres = state.settingsSnapshot.spheres;
  if (spheres.length === 0) return;

  const section = container.createDiv("flow-inbox-sphere-section");
  const toggle = section.createDiv("flow-inbox-sphere-toggle");

  spheres.forEach((sphere) => {
    const btn = toggle.createEl("button", { cls: "flow-inbox-sphere-btn" });
    btn.setText(sphere.charAt(0).toUpperCase() + sphere.slice(1));

    if (item.selectedSpheres.includes(sphere)) {
      btn.addClass("selected");
    }

    btn.addEventListener("click", () => {
      if (item.selectedSpheres.includes(sphere)) {
        item.selectedSpheres = item.selectedSpheres.filter((s) => s !== sphere);
      } else {
        item.selectedSpheres.push(sphere);
      }
      state.queueRender("editable");
    });
  });
}

function renderDueDateSection(container: HTMLElement, item: EditableItem) {
  const section = container.createDiv("flow-inbox-due-section");

  const labelSpan = section.createSpan({ cls: "label" });
  labelSpan.setText("DUE");

  const input = section.createEl("input", { cls: "flow-inbox-due-input" });
  input.type = "date";
  input.value = item.dueDate || "";

  input.addEventListener("change", () => {
    item.dueDate = input.value || undefined;
  });
}

function renderBottomBar(container: HTMLElement, item: EditableItem, state: InboxModalState) {
  const bottomBar = container.createDiv("flow-inbox-bottom-bar");

  // Delete/discard button
  const deleteBtn = bottomBar.createEl("button", { cls: "flow-inbox-delete-btn" });
  deleteBtn.setText("🗑");
  deleteBtn.title = "Discard item";
  deleteBtn.addEventListener("click", () => {
    const confirmed = confirm(
      "Are you sure you want to discard this item? This action cannot be undone."
    );
    if (confirmed) {
      state.discardItem(item);
    }
  });

  // Save button
  const isTrash = item.selectedAction === "trash";
  const saveBtn = bottomBar.createEl("button", { cls: "flow-inbox-save-btn" });
  if (isTrash) {
    saveBtn.addClass("delete-mode");
    saveBtn.setText("Delete");
  } else {
    // Count active actions for summary
    const actionCount = getActionCount(item);
    const doneCount = getDoneCount(item);
    const activeCount = actionCount - doneCount;

    let summaryText = "";
    if (doneCount > 0) {
      summaryText = ` · ${activeCount} active, ${doneCount} done`;
    } else if (actionCount > 0) {
      summaryText = ` · ${actionCount} ${actionCount === 1 ? "action" : "actions"}`;
    }

    saveBtn.innerHTML = `Save<span class="flow-inbox-action-summary">${summaryText}</span>`;
  }

  saveBtn.addEventListener("click", () => {
    state.saveAndRemoveItem(item);
  });
}

function getActionCount(item: EditableItem): number {
  if (item.editedNames && item.editedNames.length > 0) {
    return item.editedNames.length;
  }
  return 1;
}

function getDoneCount(item: EditableItem): number {
  if (!item.markAsDone) return 0;
  return item.markAsDone.filter((d) => d).length;
}
