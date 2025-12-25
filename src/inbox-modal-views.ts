// ABOUTME: Rendering functions for inbox processing UI components
// ABOUTME: Includes list pane, detail pane, and shared editing controls

import { DropdownComponent, Setting, setIcon } from "obsidian";
import { InboxModalState } from "./inbox-modal-state";
import { EditableItem } from "./inbox-types";
import { getActionLabel } from "./inbox-modal-utils";

export interface ListPaneOptions {
  onRefresh?: () => void;
  onItemSelect?: (index: number) => void;
}

export function renderListPane(
  container: HTMLElement,
  state: InboxModalState,
  options: ListPaneOptions = {}
) {
  container.empty();
  container.addClass("flow-inbox-list-pane");

  // Header
  const header = container.createDiv("flow-inbox-list-header");
  const title = header.createSpan("flow-inbox-list-title");
  title.setText(`Inbox (${state.editableItems.length})`);

  const refreshBtn = header.createEl("button", { cls: "flow-inbox-refresh clickable-icon" });
  setIcon(refreshBtn, "refresh-cw");
  refreshBtn.setAttribute("aria-label", "Refresh inbox");
  if (options.onRefresh) {
    refreshBtn.addEventListener("click", options.onRefresh);
  }

  // List or empty state
  if (state.editableItems.length === 0) {
    const emptyState = container.createDiv("flow-inbox-empty");
    const icon = emptyState.createDiv("flow-inbox-empty-icon");
    icon.setText("✨");
    emptyState.createEl("p", { text: "Your inbox is empty" });
    return;
  }

  const list = container.createDiv("flow-inbox-list");
  state.editableItems.forEach((item, index) => {
    const itemEl = list.createDiv("flow-inbox-list-item");
    if (index === state.selectedIndex) {
      itemEl.addClass("selected");
    }

    const text = itemEl.createSpan("flow-inbox-list-item-text");
    text.setText(item.original);

    itemEl.addEventListener("click", () => {
      state.selectItem(index);
      options.onItemSelect?.(index);
    });
  });
}

export interface DetailPaneOptions {
  showBack?: boolean;
  onBack?: () => void;
  onSave?: (item: EditableItem) => void;
  onDiscard?: (item: EditableItem) => void;
}

export function renderDetailPane(
  container: HTMLElement,
  state: InboxModalState,
  options: DetailPaneOptions
) {
  container.empty();
  container.addClass("flow-inbox-detail-pane");

  const item = state.selectedItem;

  // Header with buttons
  const header = container.createDiv("flow-inbox-detail-header");

  if (options.showBack) {
    const backBtn = header.createEl("button", {
      cls: "flow-inbox-back-btn clickable-icon",
    });
    setIcon(backBtn, "arrow-left");
    backBtn.createSpan().setText(`Inbox (${state.editableItems.length})`);
    if (options.onBack) {
      backBtn.addEventListener("click", options.onBack);
    }
  }

  // Empty state
  if (!item) {
    const emptyState = container.createDiv("flow-inbox-detail-empty");
    emptyState.createEl("p", { text: "Select an item to process" });
    return;
  }

  // Action buttons in header (right side)
  const headerActions = header.createDiv("flow-inbox-detail-header-actions");

  const discardBtn = headerActions.createEl("button", {
    text: "Discard",
    cls: "flow-inbox-discard-btn",
  });
  discardBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to discard this item?")) {
      options.onDiscard?.(item);
    }
  });

  const saveBtn = headerActions.createEl("button", {
    text: item.selectedAction === "trash" ? "Delete" : "Save",
    cls: "flow-inbox-save-btn mod-cta",
  });
  saveBtn.addEventListener("click", () => options.onSave?.(item));

  // Original text
  const originalSection = container.createDiv("flow-inbox-detail-section");
  const originalText = originalSection.createDiv("flow-inbox-detail-original");
  originalText.setText(item.original);

  // Action type selector
  const actionSection = container.createDiv("flow-inbox-detail-section");
  renderDetailActionTypeSelector(actionSection, item, state);

  // Conditional sections based on action type
  if (item.selectedAction === "create-project") {
    renderProjectCreationSection(container, item, state);
  } else if (item.selectedAction === "add-to-project" || item.selectedAction === "reference") {
    renderProjectSelectionSection(container, item, state);
  } else if (item.selectedAction === "person") {
    renderPersonSelectionSection(container, item, state);
  }

  // Next actions editor (for most action types)
  if (item.selectedAction !== "reference" && item.selectedAction !== "trash") {
    renderNextActionsEditor(container, item, state);
  }

  // Sphere selector (for applicable action types)
  if (
    item.selectedAction !== "add-to-project" &&
    item.selectedAction !== "reference" &&
    item.selectedAction !== "trash"
  ) {
    renderSphereSelector(container, item, state);
  }

  // Bottom options (focus, mark done, more)
  if (
    item.selectedAction === "create-project" ||
    item.selectedAction === "add-to-project" ||
    item.selectedAction === "next-actions-file"
  ) {
    renderFocusCheckbox(container, item, state);
  }

  // Date section for applicable action types
  if (item.selectedAction !== "reference" && item.selectedAction !== "trash") {
    renderDateSection(container, item, state);
  }
}

function renderDetailActionTypeSelector(
  container: HTMLElement,
  item: EditableItem,
  state: InboxModalState
) {
  const selectorEl = container.createDiv("flow-inbox-action-selector");

  const actions = [
    { key: "c", value: "create-project", label: "Create" },
    { key: "a", value: "add-to-project", label: "Add" },
    { key: "n", value: "next-actions-file", label: "Next" },
    { key: "s", value: "someday-file", label: "Someday" },
    { key: "r", value: "reference", label: "Ref" },
    { key: "p", value: "person", label: "Person" },
    { key: "t", value: "trash", label: "Trash" },
  ];

  const row1 = selectorEl.createDiv("flow-inbox-action-row");
  const row2 = selectorEl.createDiv("flow-inbox-action-row");

  actions.forEach((action, index) => {
    const row = index < 4 ? row1 : row2;
    const btn = row.createEl("button", {
      cls: "flow-inbox-action-btn",
    });
    btn.setAttribute("data-action", action.value);

    const keyHint = btn.createSpan("flow-inbox-action-key");
    keyHint.setText(action.key.toUpperCase());
    btn.appendText(" " + action.label);

    if (item.selectedAction === action.value) {
      btn.addClass("selected");
    }

    btn.addEventListener("click", () => {
      item.selectedAction = action.value as EditableItem["selectedAction"];
      state.queueRender("editable");
    });
  });
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
    const loadingContainer = contentEl.createDiv("flow-gtd-loading-state");
    loadingContainer.style.textAlign = "center";
    loadingContainer.style.padding = "48px 24px";
    loadingContainer.style.display = "flex";
    loadingContainer.style.flexDirection = "column";
    loadingContainer.style.alignItems = "center";
    loadingContainer.style.justifyContent = "center";
    loadingContainer.style.minHeight = "200px";

    const waveIcon = loadingContainer.createEl("div");
    waveIcon.style.width = "64px";
    waveIcon.style.height = "64px";
    waveIcon.style.display = "flex";
    waveIcon.style.alignItems = "center";
    waveIcon.style.justifyContent = "center";
    setIcon(waveIcon, "waves");

    const animatedSvg = loadingContainer.createEl("div");
    animatedSvg.style.marginTop = "16px";
    animatedSvg.appendChild(createLoadingDotsSpinner());
  } else if (contentEl.querySelector(".flow-gtd-loading-state")) {
    // Remove loading state if it exists
    contentEl.querySelector(".flow-gtd-loading-state")?.remove();
  }

  if (!isLoading) {
    contentEl.createEl("h2", { text: "📥 Flow inbox processing" });
  }

  if (!isLoading && contentEl.children.length === 1) {
    // Empty state
    const emptyStateContainer = contentEl.createDiv("flow-gtd-empty-state");
    emptyStateContainer.style.textAlign = "center";
    emptyStateContainer.style.padding = "48px 24px";

    const emptyIcon = emptyStateContainer.createEl("div", {
      cls: "flow-gtd-empty-icon",
    });
    emptyIcon.style.fontSize = "48px";
    emptyIcon.style.marginBottom = "16px";
    emptyIcon.setText("✨");

    emptyStateContainer.createEl("h3", {
      text: "Your inbox is empty!",
      cls: "flow-gtd-empty-title",
    });

    const emptyDescription = emptyStateContainer.createEl("p", {
      cls: "flow-gtd-empty-description",
    });
    emptyDescription.style.color = "var(--text-muted)";
    emptyDescription.style.marginTop = "12px";
    emptyDescription.style.lineHeight = "1.6";
    emptyDescription.setText(
      "No items found in your Flow inbox folders. Add files to process in your inbox folders, or close this window."
    );
  }
}

function renderActionButtonGroups(
  container: HTMLElement,
  item: EditableItem,
  state: InboxModalState
) {
  const groupsContainer = container.createDiv("flow-gtd-action-groups");
  groupsContainer.style.display = "flex";
  groupsContainer.style.flexDirection = "row";
  groupsContainer.style.flexWrap = "wrap";
  groupsContainer.style.gap = "32px";

  // Define button groups
  const groups = [
    {
      header: "Projects",
      actions: [
        { value: "create-project" as const, label: "📁 Create", icon: "📁" },
        { value: "add-to-project" as const, label: "➕ Add", icon: "➕" },
        { value: "reference" as const, label: "📄 Reference", icon: "📄" },
      ],
    },
    {
      header: "Actions",
      actions: [
        { value: "next-actions-file" as const, label: "📋 Next", icon: "📋" },
        { value: "someday-file" as const, label: "💭 Someday", icon: "💭" },
      ],
    },
    {
      header: "Other",
      actions: [
        { value: "person" as const, label: "👤 Person", icon: "👤" },
        { value: "trash" as const, label: "🗑️ Trash", icon: "🗑️" },
      ],
    },
  ];

  // Render each group
  groups.forEach((group) => {
    const groupEl = groupsContainer.createDiv("flow-gtd-action-group");
    groupEl.style.display = "flex";
    groupEl.style.flexDirection = "column";
    groupEl.style.gap = "8px";

    // Group header
    const headerEl = groupEl.createEl("div", {
      cls: "flow-gtd-action-group-header",
      text: group.header,
    });
    headerEl.style.fontSize = "12px";
    headerEl.style.fontWeight = "500";
    headerEl.style.color = "var(--text-muted)";
    headerEl.style.textTransform = "none";

    // Button row
    const buttonRow = groupEl.createDiv();
    buttonRow.style.display = "flex";
    buttonRow.style.flexDirection = "row";
    buttonRow.style.gap = "8px";

    // Render buttons
    group.actions.forEach((action) => {
      const button = buttonRow.createEl("button", {
        cls: "flow-gtd-action-button",
        text: action.label,
      });
      button.setAttribute("type", "button");

      // Apply selected state
      const currentSelection = item.selectedAction ?? "next-actions-file";
      const isSelected = currentSelection === action.value;
      if (isSelected) {
        button.addClass("selected");
      }

      // Click handler - single selection radio behaviour
      button.addEventListener("click", () => {
        item.selectedAction = action.value;
        state.queueRender("editable");
      });
    });
  });
}

export function renderEditableItemContent(
  itemEl: HTMLElement,
  item: EditableItem,
  state: InboxModalState
) {
  // Action selector - show for all items
  const actionSelectorEl = itemEl.createDiv("flow-gtd-action-selector");
  actionSelectorEl.style.marginTop = "12px";

  renderActionButtonGroups(actionSelectorEl, item, state);

  if (item.selectedAction === "create-project") {
    renderProjectCreationSection(itemEl, item, state);
  } else if (item.selectedAction === "add-to-project" || item.selectedAction === "reference") {
    renderProjectSelectionSection(itemEl, item, state);
  } else if (item.selectedAction === "person") {
    renderPersonSelectionSection(itemEl, item, state);
  }

  // Show next actions editor for actions that use next actions
  if (
    item.selectedAction === "create-project" ||
    item.selectedAction === "add-to-project" ||
    item.selectedAction === "next-actions-file" ||
    item.selectedAction === "person" ||
    item.selectedAction === "someday-file"
  ) {
    renderNextActionsEditor(itemEl, item, state);
  }

  // Show sphere selector for actions that need sphere selection
  // Exclude "add-to-project" and "reference" since existing projects already have spheres
  if (
    item.selectedAction !== "add-to-project" &&
    item.selectedAction !== "reference" &&
    item.selectedAction !== "trash"
  ) {
    renderSphereSelector(itemEl, item, state);
  }

  // Show focus checkbox for actions that create next actions
  if (
    item.selectedAction === "create-project" ||
    item.selectedAction === "add-to-project" ||
    item.selectedAction === "next-actions-file"
  ) {
    renderFocusCheckbox(itemEl, item, state);
  }

  // Show date section for actions that support dates (not reference or trash)
  if (item.selectedAction !== "reference" && item.selectedAction !== "trash") {
    renderDateSection(itemEl, item, state);
  }
}

function renderDateSection(container: HTMLElement, item: EditableItem, state: InboxModalState) {
  // Get label based on action type
  const getDateLabel = (action: string, waitingFor?: boolean[]): string | null => {
    // Check if any actions are waiting-for
    const isWaiting = waitingFor?.some((w) => w) || false;
    if (isWaiting) return "Set follow-up date (optional)";

    switch (action) {
      case "next-actions-file":
        return "Set due date (optional)";
      case "create-project":
      case "add-to-project":
        return "Set target date (optional)";
      case "someday-file":
        return "Set reminder date (optional)";
      case "person":
        return "Set follow-up date (optional)";
      default:
        return null;
    }
  };

  const label = getDateLabel(item.selectedAction, item.waitingFor);
  if (!label) return;

  // Date section (collapsible)
  const dateSection = container.createDiv("flow-gtd-date-section");
  dateSection.style.marginTop = "8px";

  const dateSectionHeader = dateSection.createDiv("flow-gtd-date-section-header");
  dateSectionHeader.style.display = "flex";
  dateSectionHeader.style.alignItems = "center";
  dateSectionHeader.style.cursor = "pointer";
  dateSectionHeader.style.fontSize = "13px";
  dateSectionHeader.style.color = "var(--text-muted)";

  const chevron = dateSectionHeader.createSpan({
    cls: "flow-gtd-date-chevron",
    text: "▶",
  });
  chevron.style.marginRight = "6px";
  chevron.style.fontSize = "10px";

  const dateLabel = dateSectionHeader.createSpan({
    cls: "flow-gtd-date-label",
  });
  dateLabel.textContent = label;

  const dateInputContainer = dateSection.createDiv("flow-gtd-date-input-container");
  dateInputContainer.style.marginTop = "8px";
  dateInputContainer.style.display = "none"; // Hidden by default

  const dateInput = dateInputContainer.createEl("input", {
    type: "date",
    cls: "flow-gtd-date-input",
  });
  dateInput.value = item.dueDate || "";
  dateInput.style.width = "150px";
  dateInput.style.marginRight = "8px";

  // Function to update clear button visibility
  const updateClearButton = () => {
    const existingButton = dateInputContainer.querySelector(".flow-gtd-date-clear");
    if (item.dueDate && !existingButton) {
      const clearButton = dateInputContainer.createEl("button", {
        text: "×",
        cls: "flow-gtd-date-clear",
      });
      clearButton.style.cursor = "pointer";
      clearButton.addEventListener("click", () => {
        item.dueDate = undefined;
        dateInput.value = "";
        updateClearButton();
      });
    } else if (!item.dueDate && existingButton) {
      existingButton.remove();
    }
  };

  dateInput.addEventListener("change", () => {
    item.dueDate = dateInput.value || undefined;
    updateClearButton();
  });

  // Initial clear button state
  updateClearButton();

  // Initialize from persisted state
  let isExpanded = item.isDateSectionExpanded || false;
  dateInputContainer.style.display = isExpanded ? "block" : "none";
  chevron.textContent = isExpanded ? "▼" : "▶";

  // Toggle collapsed/expanded
  dateSectionHeader.addEventListener("click", () => {
    isExpanded = !isExpanded;
    item.isDateSectionExpanded = isExpanded; // Persist state
    dateInputContainer.style.display = isExpanded ? "block" : "none";
    chevron.textContent = isExpanded ? "▼" : "▶";
  });
}

function renderNextActionsEditor(
  container: HTMLElement,
  item: EditableItem,
  state: InboxModalState
) {
  let currentNextActions: string[] = [];

  if (item.editedNames && item.editedNames.length > 0) {
    currentNextActions = [...item.editedNames];
  } else if (item.editedName) {
    currentNextActions = [item.editedName];
  } else {
    currentNextActions = [item.original];
  }

  const actionsContainer = container.createDiv("flow-gtd-actions-editor");
  actionsContainer.style.marginTop = "12px";

  const actionsHeader = actionsContainer.createDiv("flow-gtd-actions-header");
  actionsHeader.style.display = "flex";
  actionsHeader.style.alignItems = "center";
  actionsHeader.style.gap = "8px";
  actionsHeader.style.justifyContent = "flex-start";

  const actionsLabel = actionsHeader.createEl("label", {
    text: "Next Actions",
    cls: "flow-gtd-label",
  });
  actionsLabel.style.marginBottom = "8px";
  actionsLabel.style.fontSize = "14px";
  actionsLabel.style.fontWeight = "600";
  actionsLabel.style.color = "var(--text-normal)";
  actionsLabel.style.textTransform = "none";

  // Initialize waitingFor array if needed
  if (!item.waitingFor) {
    item.waitingFor = new Array(currentNextActions.length).fill(false);
  }
  // Ensure waitingFor array matches actions length
  while (item.waitingFor.length < currentNextActions.length) {
    item.waitingFor.push(false);
  }

  // Store reference to ensure TypeScript knows it's defined
  const waitingForArray = item.waitingFor;

  const actionsList = actionsContainer.createDiv("flow-gtd-actions-list");

  // Helper function to update add button state
  let addActionBtn: HTMLButtonElement;
  const updateAddButtonState = () => {
    if (!addActionBtn) return;
    const hasEmptyAction = currentNextActions.some((action) => action.trim() === "");
    addActionBtn.disabled = hasEmptyAction;
    addActionBtn.style.opacity = hasEmptyAction ? "0.5" : "1";
    addActionBtn.style.cursor = hasEmptyAction ? "not-allowed" : "pointer";
  };

  currentNextActions.forEach((action, index) => {
    const actionItem = actionsList.createDiv("flow-gtd-action-item");

    // Numbered badge
    const numberBadge = actionItem.createDiv("flow-gtd-action-number");
    numberBadge.setText(String(index + 1));

    // Input container
    const inputContainer = actionItem.createDiv();
    inputContainer.style.flex = "1";
    inputContainer.style.minWidth = "0";

    const actionInput = inputContainer.createEl("input", {
      type: "text",
      cls: "flow-gtd-action-input",
    });
    actionInput.value = action;
    actionInput.placeholder = `Enter action ${index + 1}...`;
    actionInput.style.border = "none";
    actionInput.style.padding = "0";
    actionInput.style.backgroundColor = "transparent";
    actionInput.style.fontSize = "14px";

    actionInput.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      currentNextActions[index] = value;
      item.editedNames = [...currentNextActions];
      if (currentNextActions.length > 1) {
        item.editedName = undefined;
      } else {
        item.editedName = value;
      }
      updateAddButtonState();
    });

    // Waiting-for toggle button
    const waitingToggle = actionItem.createEl("button", {
      cls: "flow-gtd-next-action-waiting-toggle",
      text: "🤝",
    });
    waitingToggle.setAttribute("type", "button");
    waitingToggle.title = "Toggle waiting for";
    waitingToggle.style.marginLeft = "8px";

    // Set initial state
    const isWaiting = waitingForArray[index] || false;
    if (isWaiting) {
      waitingToggle.classList.add("active");
    }

    waitingToggle.addEventListener("click", () => {
      waitingForArray[index] = !waitingForArray[index];
      waitingToggle.classList.toggle("active", waitingForArray[index]);
    });

    const removeBtn = actionItem.createEl("button", {
      cls: "flow-gtd-action-remove",
    });
    removeBtn.setAttribute("type", "button");
    removeBtn.setAttribute("aria-label", "Remove action");
    removeBtn.setAttribute("title", "Remove action");
    removeBtn.setText("✕");

    // Disable remove button if there's only one action
    const isOnlyAction = currentNextActions.length === 1;
    removeBtn.disabled = isOnlyAction;

    if (!isOnlyAction) {
      removeBtn.addEventListener("click", () => {
        currentNextActions.splice(index, 1);
        waitingForArray.splice(index, 1);
        item.editedNames = [...currentNextActions];
        if (currentNextActions.length === 1) {
          item.editedName = currentNextActions[0];
        }
        state.queueRender("editable");
      });
    }
  });

  // Add action button
  addActionBtn = actionsList.createEl("button", {
    cls: "flow-gtd-add-action-btn",
  });
  addActionBtn.setAttribute("type", "button");
  addActionBtn.setAttribute("aria-label", "Add action");
  const plusSpan = addActionBtn.createSpan();
  plusSpan.style.fontSize = "18px";
  plusSpan.setText("+");
  addActionBtn.appendText(" Add action");

  // Set initial state
  updateAddButtonState();

  addActionBtn.addEventListener("click", () => {
    if (addActionBtn.disabled) return;
    currentNextActions.push("");
    item.editedNames = [...currentNextActions];
    waitingForArray.push(false);
    state.queueRender("editable");
  });

  if (currentNextActions.length === 1) {
    item.editedName = currentNextActions[0];
    item.editedNames = undefined;
  }
}

function renderProjectCreationSection(
  container: HTMLElement,
  item: EditableItem,
  state: InboxModalState
) {
  const projectEl = container.createDiv("flow-gtd-project-section");
  projectEl.style.marginTop = "12px";

  const projectLabel = projectEl.createEl("label", {
    text: "New Project Name",
    cls: "flow-gtd-label",
  });
  projectLabel.style.display = "block";
  projectLabel.style.marginBottom = "8px";
  projectLabel.style.fontSize = "14px";
  projectLabel.style.fontWeight = "600";
  projectLabel.style.color = "var(--text-normal)";
  projectLabel.style.textTransform = "none";

  const projectInput = projectEl.createEl("input", {
    type: "text",
    cls: "flow-gtd-project-input",
  });
  projectInput.placeholder = "Enter project name...";
  projectInput.value = item.editedProjectTitle || "";
  projectInput.addEventListener("input", (e) => {
    item.editedProjectTitle = (e.target as HTMLInputElement).value;
  });

  const subProjectToggleContainer = projectEl.createDiv("flow-gtd-subproject-toggle");
  subProjectToggleContainer.style.display = "flex";
  subProjectToggleContainer.style.alignItems = "center";
  subProjectToggleContainer.style.gap = "8px";

  const subProjectCheckbox = subProjectToggleContainer.createEl("input", {
    type: "checkbox",
  });
  subProjectCheckbox.id = state.getUniqueId("sub-project-toggle");
  subProjectCheckbox.checked = item.isSubProject || false;
  subProjectCheckbox.addEventListener("change", (e) => {
    item.isSubProject = (e.target as HTMLInputElement).checked;
    state.queueRender("editable");
  });

  const subProjectLabel = subProjectToggleContainer.createEl("label");
  subProjectLabel.setAttribute("for", subProjectCheckbox.id);
  subProjectLabel.setText("Create as sub-project");
  subProjectLabel.style.cursor = "pointer";
  subProjectLabel.style.fontSize = "14px";
  subProjectLabel.style.color = "var(--text-normal)";

  // Show parent project selector if creating as sub-project
  if (item.isSubProject) {
    const parentSelectorEl = projectEl.createDiv();
    parentSelectorEl.style.marginTop = "12px";

    const parentLabel = parentSelectorEl.createEl("label", {
      text: "Parent Project",
      cls: "flow-gtd-label",
    });
    parentLabel.style.display = "block";
    parentLabel.style.marginBottom = "8px";
    parentLabel.style.fontSize = "14px";
    parentLabel.style.fontWeight = "600";
    parentLabel.style.color = "var(--text-normal)";
    parentLabel.style.textTransform = "none";

    const parentSearchInput = parentSelectorEl.createEl("input", {
      type: "text",
      placeholder: "Type to search parent projects...",
    });
    parentSearchInput.addClass("flow-gtd-project-search");
    parentSearchInput.value = item.parentProject?.title || "";
    parentSearchInput.style.width = "100%";
    parentSearchInput.style.padding = "8px 12px";
    parentSearchInput.style.fontSize = "14px";
    parentSearchInput.style.border = "1px solid var(--background-modifier-border)";
    parentSearchInput.style.borderRadius = "4px";
    parentSearchInput.style.backgroundColor = "var(--background-primary)";
    parentSearchInput.style.color = "var(--text-normal)";

    const parentListContainer = parentSelectorEl.createDiv();
    parentListContainer.style.maxHeight = "200px";
    parentListContainer.style.overflowY = "auto";
    parentListContainer.style.border = "1px solid var(--background-modifier-border)";
    parentListContainer.style.borderRadius = "4px";
    parentListContainer.style.marginTop = "8px";
    parentListContainer.style.display = "none";

    const updateParentList = (searchTerm: string) => {
      parentListContainer.empty();

      const filtered = searchTerm
        ? state.existingProjects.filter((project) =>
            project.title.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : state.existingProjects;

      if (filtered.length === 0) {
        parentListContainer.createEl("div", {
          text: "No projects found",
        });
        parentListContainer.style.display = "block";
        return;
      }

      const sorted = [...filtered].sort((a, b) => {
        const mtimeA = a.mtime || 0;
        const mtimeB = b.mtime || 0;
        return mtimeB - mtimeA;
      });

      sorted.forEach((project) => {
        const projectButton = parentListContainer.createEl("button", {
          text: project.title,
        });
        projectButton.setAttribute("type", "button");
        projectButton.style.width = "100%";
        projectButton.style.padding = "8px 12px";
        projectButton.style.textAlign = "left";
        projectButton.style.border = "none";
        projectButton.style.backgroundColor = "transparent";
        projectButton.style.cursor = "pointer";
        projectButton.style.fontSize = "14px";
        projectButton.style.color = "var(--text-normal)";

        if (item.parentProject?.file === project.file) {
          projectButton.style.backgroundColor = "var(--background-modifier-hover)";
          projectButton.style.fontWeight = "600";
        }

        projectButton.addEventListener("mouseenter", () => {
          projectButton.style.backgroundColor = "var(--background-modifier-hover)";
        });
        projectButton.addEventListener("mouseleave", () => {
          if (item.parentProject?.file !== project.file) {
            projectButton.style.backgroundColor = "transparent";
          }
        });

        projectButton.addEventListener("click", () => {
          item.parentProject = project;
          parentSearchInput.value = project.title;
          parentListContainer.style.display = "none";
          state.queueRender("editable");
        });
      });

      parentListContainer.style.display = "block";
    };

    parentSearchInput.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      updateParentList(value);
    });

    parentSearchInput.addEventListener("focus", () => {
      updateParentList(parentSearchInput.value);
    });

    parentSearchInput.addEventListener("blur", () => {
      setTimeout(() => {
        parentListContainer.style.display = "none";
      }, 200);
    });
  }

  if (item.projectPriority === undefined) {
    item.projectPriority = state.settingsSnapshot.defaultPriority;
  }

  const prioritySetting = new Setting(projectEl)
    .setName("Project priority")
    .setDesc("1 (highest) to 5 (lowest)");
  prioritySetting.addDropdown((dropdown) => {
    // Force visible text with inline styles
    dropdown.selectEl.style.color = "var(--text-normal)";
    dropdown.selectEl.style.fontSize = "14px";

    ["1", "2", "3", "4", "5"].forEach((value) => dropdown.addOption(value, value));
    dropdown.setValue(String(item.projectPriority));
    dropdown.onChange((value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        item.projectPriority = parsed;
      }
    });
  });
}

function renderProjectSelectionSection(
  container: HTMLElement,
  item: EditableItem,
  state: InboxModalState
) {
  const projectSelectorEl = container.createDiv("flow-gtd-project-selector");
  projectSelectorEl.style.marginTop = "12px";

  const projectSelectId = state.getUniqueId("flow-gtd-project");
  const projectLabelText = "Select Project";
  const projectLabel = projectSelectorEl.createEl("label", {
    text: projectLabelText,
    cls: "flow-gtd-label",
  });
  projectLabel.setAttribute("for", projectSelectId);
  projectLabel.style.display = "block";
  projectLabel.style.marginBottom = "8px";
  projectLabel.style.fontSize = "14px";
  projectLabel.style.fontWeight = "600";
  projectLabel.style.color = "var(--text-normal)";
  projectLabel.style.textTransform = "none";

  // Search input
  const searchInput = projectSelectorEl.createEl("input", {
    type: "text",
    placeholder: "Type to search projects...",
  });
  searchInput.id = projectSelectId;
  searchInput.addClass("flow-gtd-project-search");
  searchInput.value = item.selectedProject?.title || "";
  searchInput.style.width = "100%";
  searchInput.style.padding = "8px 12px";
  searchInput.style.fontSize = "14px";
  searchInput.style.border = "1px solid var(--background-modifier-border)";
  searchInput.style.borderRadius = "4px";
  searchInput.style.backgroundColor = "var(--background-primary)";
  searchInput.style.color = "var(--text-normal)";

  // Container for filtered projects list
  const projectListContainer = projectSelectorEl.createDiv("flow-gtd-project-list");
  projectListContainer.style.maxHeight = "200px";
  projectListContainer.style.overflowY = "auto";
  projectListContainer.style.border = "1px solid var(--background-modifier-border)";
  projectListContainer.style.borderRadius = "4px";
  projectListContainer.style.marginTop = "8px";
  projectListContainer.style.display = "none"; // Hidden by default

  const updateProjectList = (searchTerm: string) => {
    projectListContainer.empty();

    const filtered = searchTerm
      ? state.existingProjects.filter((project) =>
          project.title.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : state.existingProjects;

    if (filtered.length === 0) {
      projectListContainer.createEl("div", {
        text: "No projects found",
        cls: "flow-gtd-project-list-empty",
      });
      projectListContainer.style.display = "block";
      return;
    }

    const sorted = [...filtered].sort((a, b) => {
      // Sort by modification time, most recent first
      const mtimeA = a.mtime || 0;
      const mtimeB = b.mtime || 0;
      return mtimeB - mtimeA;
    });

    sorted.forEach((project) => {
      const projectButton = projectListContainer.createEl("button", {
        text: project.title,
        cls: "flow-gtd-project-list-item",
      });
      projectButton.setAttribute("type", "button");
      projectButton.style.width = "100%";
      projectButton.style.padding = "8px 12px";
      projectButton.style.textAlign = "left";
      projectButton.style.border = "none";
      projectButton.style.backgroundColor = "transparent";
      projectButton.style.cursor = "pointer";
      projectButton.style.fontSize = "14px";
      projectButton.style.color = "var(--text-normal)";

      if (item.selectedProject?.file === project.file) {
        projectButton.style.backgroundColor = "var(--background-modifier-hover)";
        projectButton.style.fontWeight = "600";
      }

      projectButton.addEventListener("mouseenter", () => {
        projectButton.style.backgroundColor = "var(--background-modifier-hover)";
      });
      projectButton.addEventListener("mouseleave", () => {
        if (item.selectedProject?.file !== project.file) {
          projectButton.style.backgroundColor = "transparent";
        }
      });

      projectButton.addEventListener("click", () => {
        item.selectedProject = project;
        searchInput.value = project.title;
        projectListContainer.style.display = "none";
        state.queueRender("editable");
      });
    });

    projectListContainer.style.display = "block";
  };

  searchInput.addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value;
    updateProjectList(value);
  });

  searchInput.addEventListener("focus", () => {
    updateProjectList(searchInput.value);
  });

  // Close list when clicking outside
  searchInput.addEventListener("blur", () => {
    setTimeout(() => {
      projectListContainer.style.display = "none";
    }, 200);
  });
}

function renderPersonSelectionSection(
  container: HTMLElement,
  item: EditableItem,
  state: InboxModalState
) {
  const personSelectorEl = container.createDiv("flow-gtd-person-selector");
  personSelectorEl.style.marginTop = "12px";

  const personSelectId = state.getUniqueId("flow-gtd-person");
  const personLabelText = "Discuss With";
  const personLabel = personSelectorEl.createEl("label", {
    text: personLabelText,
    cls: "flow-gtd-label",
  });
  personLabel.setAttribute("for", personSelectId);
  personLabel.style.display = "block";
  personLabel.style.marginBottom = "8px";
  personLabel.style.fontSize = "14px";
  personLabel.style.fontWeight = "600";
  personLabel.style.color = "var(--text-normal)";
  personLabel.style.textTransform = "none";

  const personDropdown = new DropdownComponent(personSelectorEl);
  personDropdown.selectEl.id = personSelectId;
  personDropdown.selectEl.addClass("flow-gtd-inline-select");
  personDropdown.selectEl.setAttribute("aria-label", personLabelText);

  // Force visible text with inline styles
  personDropdown.selectEl.style.color = "var(--text-normal)";
  personDropdown.selectEl.style.fontSize = "14px";

  personDropdown.addOption("", "-- Select a person --");
  state.existingPersons.forEach((person) => {
    personDropdown.addOption(person.file, person.title);
  });

  const selectedValue = item.selectedPerson?.file || "";

  if (selectedValue && !state.existingPersons.find((person) => person.file === selectedValue)) {
    personDropdown.addOption(selectedValue, item.selectedPerson?.title || selectedValue);
  }

  personDropdown.setValue(selectedValue);
  personDropdown.onChange((value) => {
    item.selectedPerson = state.existingPersons.find((p) => p.file === value) || undefined;
  });
}

function renderSphereSelector(container: HTMLElement, item: EditableItem, state: InboxModalState) {
  const spheres = state.settingsSnapshot.spheres;
  if (spheres.length === 0) {
    return;
  }

  const sphereSelectorEl = container.createDiv("flow-gtd-sphere-selector");
  sphereSelectorEl.style.marginTop = "12px";

  const sphereLabel = sphereSelectorEl.createEl("label", {
    text: "Sphere",
    cls: "flow-gtd-label",
  });
  sphereLabel.style.display = "block";
  sphereLabel.style.marginBottom = "8px";
  sphereLabel.style.fontSize = "14px";
  sphereLabel.style.fontWeight = "600";
  sphereLabel.style.color = "var(--text-normal)";
  sphereLabel.style.textTransform = "none";

  if (item.selectedSpheres.length > 0) {
    const countSpan = sphereLabel.createSpan();
    countSpan.style.fontWeight = "400";
    countSpan.style.color = "var(--text-muted)";
    countSpan.setText(` (${item.selectedSpheres.length} selected)`);
  }

  const buttonContainer = sphereSelectorEl.createDiv("flow-gtd-sphere-buttons");
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "8px";

  spheres.forEach((sphere) => {
    const button = buttonContainer.createEl("button", {
      cls: "flow-gtd-sphere-button",
    });
    button.setAttribute("type", "button");

    // Capitalize first letter
    const displayText = sphere.charAt(0).toUpperCase() + sphere.slice(1);
    button.setText(displayText);

    if (item.selectedSpheres.includes(sphere)) {
      button.addClass("selected");
    }

    button.addEventListener("click", () => {
      if (item.selectedSpheres.includes(sphere)) {
        item.selectedSpheres = item.selectedSpheres.filter((s) => s !== sphere);
        button.removeClass("selected");
      } else {
        item.selectedSpheres.push(sphere);
        button.addClass("selected");
      }
      // Re-render to update the count
      state.queueRender("editable");
    });
  });
}

function renderFocusCheckbox(container: HTMLElement, item: EditableItem, state: InboxModalState) {
  const checkboxesContainer = container.createDiv("flow-gtd-action-checkboxes");
  checkboxesContainer.style.marginTop = "12px";
  checkboxesContainer.style.display = "flex";
  checkboxesContainer.style.gap = "24px";

  // Add to focus checkbox
  const focusContainer = checkboxesContainer.createDiv("flow-gtd-focus-checkbox");
  focusContainer.style.display = "flex";
  focusContainer.style.alignItems = "center";
  focusContainer.style.gap = "8px";

  const focusCheckbox = focusContainer.createEl("input", {
    type: "checkbox",
  });
  focusCheckbox.id = state.getUniqueId("add-to-focus");
  focusCheckbox.checked = item.addToFocus || false;

  const focusLabel = focusContainer.createEl("label");
  focusLabel.setAttribute("for", focusCheckbox.id);
  focusLabel.setText("Add to focus");
  focusLabel.style.cursor = "pointer";
  focusLabel.style.fontSize = "14px";
  focusLabel.style.color = "var(--text-normal)";

  // Mark as done checkbox
  const doneContainer = checkboxesContainer.createDiv("flow-gtd-mark-done-checkbox");
  doneContainer.style.display = "flex";
  doneContainer.style.alignItems = "center";
  doneContainer.style.gap = "8px";

  const doneCheckbox = doneContainer.createEl("input", {
    type: "checkbox",
  });
  doneCheckbox.id = state.getUniqueId("mark-as-done");
  // Initialize markAsDone array if not exists (single item for now, will be expanded for multiple actions)
  if (!item.markAsDone) {
    item.markAsDone = [];
  }
  doneCheckbox.checked = item.markAsDone[0] || false;

  const doneLabel = doneContainer.createEl("label");
  doneLabel.setAttribute("for", doneCheckbox.id);
  doneLabel.setText("Mark as done");
  doneLabel.style.cursor = "pointer";
  doneLabel.style.fontSize = "14px";
  doneLabel.style.color = "var(--text-normal)";

  // Mutual exclusion: when one is checked, uncheck the other
  focusCheckbox.addEventListener("change", (e) => {
    const isChecked = (e.target as HTMLInputElement).checked;
    item.addToFocus = isChecked;

    if (isChecked && item.markAsDone && item.markAsDone[0]) {
      item.markAsDone[0] = false;
      doneCheckbox.checked = false;
    }
  });

  doneCheckbox.addEventListener("change", (e) => {
    const isChecked = (e.target as HTMLInputElement).checked;
    if (!item.markAsDone) {
      item.markAsDone = [];
    }
    item.markAsDone[0] = isChecked;

    if (isChecked && item.addToFocus) {
      item.addToFocus = false;
      focusCheckbox.checked = false;
    }
  });
}

/**
 * Creates an animated "Loading..." SVG spinner with animated dots.
 */
function createLoadingDotsSpinner(): SVGElement {
  const svgNS = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 130 30");
  svg.setAttribute("width", "130px");
  svg.setAttribute("height", "30px");

  const text = document.createElementNS(svgNS, "text");
  text.setAttribute("font-family", "monospace");
  text.setAttribute("fill", "var(--text-accent)");
  text.setAttribute("font-size", "20");
  text.setAttribute("y", "22");

  const loadingTspan = document.createElementNS(svgNS, "tspan");
  loadingTspan.textContent = "Loading";
  text.appendChild(loadingTspan);

  // Create three animated dots
  const delays = ["0s", "0.15s", "0.3s"];
  for (const delay of delays) {
    const dotTspan = document.createElementNS(svgNS, "tspan");
    dotTspan.textContent = ".";

    const animate = document.createElementNS(svgNS, "animate");
    animate.setAttribute("attributeName", "opacity");
    animate.setAttribute("values", "0;1");
    animate.setAttribute("dur", "0.4s");
    animate.setAttribute("begin", delay);
    animate.setAttribute("repeatCount", "indefinite");

    dotTspan.appendChild(animate);
    text.appendChild(dotTspan);
  }

  svg.appendChild(text);
  return svg;
}
