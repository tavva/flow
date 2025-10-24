import { DropdownComponent, Setting, setIcon } from "obsidian";
import { InboxModalState } from "./inbox-modal-state";
import { EditableItem } from "./inbox-types";
import { getActionLabel } from "./inbox-modal-utils";

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
    const loadingContainer = contentEl.createDiv("flow-gtd-loading-state");
    loadingContainer.style.textAlign = "center";
    loadingContainer.style.padding = "48px 24px";
    loadingContainer.style.display = "flex";
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
  } else if (contentEl.querySelector(".flow-gtd-loading-state")) {
    // Remove loading state if it exists
    contentEl.querySelector(".flow-gtd-loading-state")?.remove();
  }

  if (!isLoading) {
    contentEl.createEl("h2", { text: "📥 Inbox Files Processing" });
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

export function renderEditableItemsView(
  contentEl: HTMLElement,
  state: InboxModalState,
  { onClose }: EditableItemsViewOptions
) {
  contentEl.empty();
  contentEl.addClass("flow-gtd-inbox-modal");

  // Header section with title, description, and refine all button
  const headerSection = contentEl.createDiv("flow-gtd-header-section");
  headerSection.style.display = "flex";
  headerSection.style.justifyContent = "space-between";
  headerSection.style.alignItems = "flex-start";
  headerSection.style.gap = "24px";
  headerSection.style.marginBottom = "24px";

  const headerLeft = headerSection.createDiv();
  headerLeft.style.flex = "1";

  headerLeft.createEl("h2", { text: "Flow inbox processing" });
  headerLeft.createEl("p", {
    text: "Review your inbox items. You can edit them manually or refine with AI, then save them to your vault.",
    cls: "flow-gtd-description",
  });

  // Refine all button (right-aligned)
  if (state.editableItems.length > 0) {
    const unprocessedCount = state.editableItems.filter((item) => !item.isAIProcessed).length;

    if (unprocessedCount > 0) {
      const headerRight = headerSection.createDiv();
      headerRight.style.flexShrink = "0";

      const refineAllBtn = headerRight.createEl("button", {
        text: state.isBulkRefining
          ? `⏳ Refining ${unprocessedCount} items...`
          : `✨ Refine all (${unprocessedCount})`,
        cls: "flow-gtd-refine-all-button",
      });
      refineAllBtn.setAttribute("type", "button");
      refineAllBtn.disabled = state.isBulkRefining;
      refineAllBtn.style.cursor = state.isBulkRefining ? "not-allowed" : "pointer";
      refineAllBtn.style.opacity = state.isBulkRefining ? "0.6" : "1";
      refineAllBtn.addEventListener("click", () => state.refineAllWithAI());
    }
  }

  renderIndividualEditableItems(contentEl, state);

  if (state.editableItems.length === 0) {
    const completionEl = contentEl.createDiv("flow-gtd-completion");
    completionEl.createEl("h3", { text: "🎉 All items processed!" });
    completionEl.createEl("p", { text: "Your inbox is now empty." });

    new Setting(completionEl).addButton((button) =>
      button.setButtonText("Close").setCta().onClick(onClose)
    );
  }
}

function renderIndividualEditableItems(container: HTMLElement, state: InboxModalState) {
  const listContainer = container.createDiv("flow-gtd-items-list");

  if (state.editableItems.length === 0) {
    listContainer.createEl("p", {
      text: "No items to display.",
      cls: "flow-gtd-empty",
    });
    return;
  }

  state.editableItems.forEach((item, index) => {
    const itemEl = listContainer.createDiv("flow-gtd-editable-item");

    // Header with item number and AI badge/button
    const metaRow = itemEl.createDiv("flow-gtd-item-meta");
    const showIndex = state.editableItems.length > 1;

    const leftSide = metaRow.createDiv();
    leftSide.style.display = "flex";
    leftSide.style.alignItems = "center";
    leftSide.style.gap = "12px";

    if (showIndex) {
      leftSide.createSpan({
        text: `#${index + 1}`,
        cls: "flow-gtd-item-index",
      });
    }

    if (item.isAIProcessed) {
      const aiBadge = leftSide.createSpan({
        cls: "flow-gtd-item-pill flow-gtd-item-pill-success",
      });
      aiBadge.createSpan({ text: "✨ " });
      aiBadge.createSpan({ text: "AI Refined" });
    } else if (item.isProcessing === true) {
      leftSide.createSpan({
        text: "Processing…",
        cls: "flow-gtd-item-pill flow-gtd-item-pill-warn",
      });
    } else {
      // AI Refine button (only if not processed and not processing) - on the left
      const refineBtn = leftSide.createEl("button", {
        type: "button",
        cls: "flow-gtd-ai-refine-button",
      });
      refineBtn.setAttribute("aria-label", "Refine with AI");
      refineBtn.innerHTML = "✨ AI Refine";
      refineBtn.addEventListener("click", () => state.refineIndividualItem(item));
    }

    // Original Text - different display based on refined status
    if (item.isAIProcessed) {
      // Simple original text display for refined items
      const originalBox = itemEl.createDiv("flow-gtd-original-box");

      const label = originalBox.createDiv();
      label.addClass("flow-gtd-section-label");
      label.style.marginBottom = "8px";
      label.setText("Original");

      const textDiv = originalBox.createDiv();
      textDiv.addClass("flow-gtd-original-text");
      textDiv.style.userSelect = "text";
      textDiv.style.cursor = "text";
      textDiv.setText(item.original);
    } else {
      // Prominent box for non-refined items
      const originalBox = itemEl.createDiv("flow-gtd-original-unprocessed");
      originalBox.style.padding = "16px";
      originalBox.style.backgroundColor = "rgba(33, 150, 243, 0.05)";
      originalBox.style.border = "2px solid rgba(33, 150, 243, 0.2)";
      originalBox.style.borderRadius = "8px";

      const label = originalBox.createDiv();
      label.style.fontSize = "14px";
      label.style.fontWeight = "600";
      label.style.marginBottom = "8px";
      label.style.color = "var(--text-normal)";
      label.setText("Item to Process:");

      const textDiv = originalBox.createDiv();
      textDiv.style.color = "var(--text-normal)";
      textDiv.style.lineHeight = "1.6";
      textDiv.style.userSelect = "text";
      textDiv.style.cursor = "text";
      textDiv.setText(item.original);
    }

    renderEditableItemContent(itemEl, item, state);

    const actionButtons = itemEl.createDiv("flow-gtd-item-actions");
    actionButtons.style.marginTop = "16px";
    actionButtons.style.paddingTop = "16px";
    actionButtons.style.borderTop = "1px solid var(--background-modifier-border)";
    actionButtons.style.display = "flex";
    actionButtons.style.justifyContent = "space-between";
    actionButtons.style.alignItems = "center";

    // Discard button on the left
    const discardButton = actionButtons.createEl("button", {
      text: "Discard",
      cls: "flow-gtd-discard-button",
    });
    discardButton.setAttribute("type", "button");
    discardButton.style.backgroundColor = "transparent";
    discardButton.style.color = "var(--text-muted)";
    discardButton.style.border = "none";
    discardButton.style.padding = "8px 20px";
    discardButton.style.borderRadius = "8px";
    discardButton.style.cursor = "pointer";
    discardButton.style.fontSize = "14px";
    discardButton.style.fontWeight = "500";
    discardButton.style.transition = "color 0.2s ease";
    discardButton.addEventListener("mouseenter", () => {
      discardButton.style.color = "var(--text-normal)";
    });
    discardButton.addEventListener("mouseleave", () => {
      discardButton.style.color = "var(--text-muted)";
    });
    discardButton.addEventListener("click", () => {
      const confirmed = confirm(
        "Are you sure you want to discard this item? This action cannot be undone."
      );
      if (confirmed) {
        state.discardItem(item);
      }
    });

    // Save or Delete button on the right
    const primaryButton = actionButtons.createEl("button", {
      text: item.selectedAction === "trash" ? "Delete" : "Save",
      cls: "flow-gtd-save-button",
    });
    primaryButton.setAttribute("type", "button");
    primaryButton.disabled = item.isProcessing === true;

    if (item.selectedAction === "trash") {
      primaryButton.style.backgroundColor = "var(--color-red)";
      primaryButton.style.color = "white";
    } else {
      primaryButton.style.backgroundColor = "var(--interactive-accent)";
      primaryButton.style.color = "white";
    }

    primaryButton.style.border = "none";
    primaryButton.style.padding = "10px 32px";
    primaryButton.style.borderRadius = "8px";
    primaryButton.style.cursor = item.isProcessing ? "not-allowed" : "pointer";
    primaryButton.style.fontSize = "14px";
    primaryButton.style.fontWeight = "500";
    primaryButton.style.transition = "background-color 0.2s ease";
    primaryButton.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";

    if (!item.isProcessing) {
      primaryButton.addEventListener("mouseenter", () => {
        if (item.selectedAction === "trash") {
          primaryButton.style.backgroundColor = "var(--color-red)";
          primaryButton.style.opacity = "0.9";
        } else {
          primaryButton.style.opacity = "0.9";
        }
      });
      primaryButton.addEventListener("mouseleave", () => {
        primaryButton.style.opacity = "1";
      });
    } else {
      primaryButton.style.opacity = "0.6";
    }

    primaryButton.addEventListener("click", () => {
      if (!item.isProcessing) {
        state.saveAndRemoveItem(item);
      }
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

  const actionLabel = actionSelectorEl.createEl("label", {
    text: "How to Process",
    cls: "flow-gtd-label",
  });
  actionLabel.style.display = "block";
  actionLabel.style.marginBottom = "8px";
  actionLabel.style.fontSize = "14px";
  actionLabel.style.fontWeight = "600";
  actionLabel.style.color = "var(--text-normal)";
  actionLabel.style.textTransform = "none";

  const actionSelectId = state.getUniqueId("flow-gtd-action");
  actionLabel.setAttribute("for", actionSelectId);

  const actionDropdown = new DropdownComponent(actionSelectorEl);
  actionDropdown.selectEl.id = actionSelectId;
  actionDropdown.selectEl.addClass("flow-gtd-inline-select");
  actionDropdown.selectEl.setAttribute("aria-label", "How to Process");

  // Force visible text with inline styles
  actionDropdown.selectEl.style.color = "var(--text-normal)";
  actionDropdown.selectEl.style.fontSize = "14px";

  const actions: Array<{
    value: EditableItem["selectedAction"];
    label: string;
  }> = [
    { value: "create-project", label: "Create New Project" },
    { value: "add-to-project", label: "Add to Existing Project" },
    { value: "next-actions-file", label: "Next Actions File" },
    { value: "someday-file", label: "Someday/Maybe File" },
    { value: "reference", label: "Reference (Not Actionable)" },
    { value: "person", label: "Discuss with Person" },
    { value: "trash", label: "Trash (Delete)" },
  ];
  actions.forEach(({ value, label }) => actionDropdown.addOption(value, label));
  actionDropdown.setValue(item.selectedAction ?? "next-actions-file");
  actionDropdown.onChange((value) => {
    item.selectedAction = value as EditableItem["selectedAction"];
    state.queueRender("editable");
  });

  if (item.selectedAction === "create-project") {
    renderProjectCreationSection(itemEl, item, state);
  } else if (item.selectedAction === "add-to-project") {
    renderProjectSelectionSection(itemEl, item, state);
  } else if (item.selectedAction === "person") {
    renderPersonSelectionSection(itemEl, item, state);
  } else if (item.selectedAction === "someday-file") {
    renderSomedayReminderSection(itemEl, item, state);
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
  // Exclude "add-to-project" since existing projects already have spheres
  if (item.selectedAction !== "add-to-project" && item.selectedAction !== "trash") {
    renderSphereSelector(itemEl, item, state);
  }

  // Show hotlist checkbox for actions that create next actions
  if (
    item.selectedAction === "create-project" ||
    item.selectedAction === "add-to-project" ||
    item.selectedAction === "next-actions-file"
  ) {
    renderHotlistCheckbox(itemEl, item, state);
  }
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
  } else if (item.result) {
    if (item.result.nextActions && item.result.nextActions.length > 0) {
      currentNextActions = [...item.result.nextActions];
    } else if (item.result.nextAction) {
      currentNextActions = [item.result.nextAction];
    }
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
  actionsLabel.style.marginBottom = "0";
  actionsLabel.style.fontSize = "14px";
  actionsLabel.style.fontWeight = "600";
  actionsLabel.style.color = "var(--text-normal)";
  actionsLabel.style.textTransform = "none";

  // Initialize waitingFor array if needed
  if (!item.waitingFor) {
    item.waitingFor = new Array(currentNextActions.length).fill(false);
    // Set initial waiting-for state from AI if available
    if (item.result?.isWaitingFor && item.isAIProcessed) {
      item.waitingFor = item.waitingFor.map(() => true);
    }
  }
  // Ensure waitingFor array matches actions length
  while (item.waitingFor.length < currentNextActions.length) {
    item.waitingFor.push(false);
  }

  // Store reference to ensure TypeScript knows it's defined
  const waitingForArray = item.waitingFor;

  const actionsList = actionsContainer.createDiv("flow-gtd-actions-list");
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
    });

    // Waiting-for toggle button
    const waitingToggle = actionItem.createEl("button", {
      cls: "flow-gtd-next-action-waiting-toggle",
      text: "⏰",
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
    removeBtn.innerHTML = "✕";
    removeBtn.addEventListener("click", () => {
      currentNextActions.splice(index, 1);
      waitingForArray.splice(index, 1);
      item.editedNames = [...currentNextActions];
      if (currentNextActions.length === 1) {
        item.editedName = currentNextActions[0];
      }
      state.queueRender("editable");
    });
  });

  // Add action button
  const addActionBtn = actionsList.createEl("button", {
    cls: "flow-gtd-add-action-btn",
  });
  addActionBtn.setAttribute("type", "button");
  addActionBtn.setAttribute("aria-label", "Add action");
  addActionBtn.innerHTML = '<span style="font-size: 18px">+</span> Add action';
  addActionBtn.addEventListener("click", () => {
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
  projectInput.value = item.editedProjectTitle || item.result?.projectOutcome || "";
  projectInput.addEventListener("input", (e) => {
    item.editedProjectTitle = (e.target as HTMLInputElement).value;
  });

  // Sub-project toggle and parent selection
  // Initialize from AI suggestion if available
  if (item.isSubProject === undefined && item.isAIProcessed && item.result?.suggestedProjects) {
    const suggestion = item.result.suggestedProjects[0];
    if (suggestion?.asSubProject) {
      item.isSubProject = true;
      // Find parent project from the suggestion
      if (suggestion.parentProject) {
        item.parentProject = state.existingProjects.find(
          (p) => p.file === suggestion.parentProject
        );
      }
    }
  }

  const subProjectToggleContainer = projectEl.createDiv();
  subProjectToggleContainer.style.marginTop = "12px";
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

    // Show AI suggestion for parent project if available
    if (
      item.isAIProcessed &&
      item.result?.suggestedProjects?.[0]?.asSubProject &&
      item.result.suggestedProjects[0].parentProject &&
      item.parentProject
    ) {
      const aiSuggestionBox = parentSelectorEl.createDiv();
      aiSuggestionBox.style.display = "flex";
      aiSuggestionBox.style.alignItems = "flex-start";
      aiSuggestionBox.style.gap = "8px";
      aiSuggestionBox.style.padding = "12px";
      aiSuggestionBox.style.backgroundColor = "rgba(76, 175, 80, 0.1)";
      aiSuggestionBox.style.border = "1px solid rgba(76, 175, 80, 0.3)";
      aiSuggestionBox.style.borderRadius = "8px";
      aiSuggestionBox.style.marginTop = "12px";

      const sparkleIcon = aiSuggestionBox.createSpan();
      sparkleIcon.setText("✨");
      sparkleIcon.style.flexShrink = "0";
      sparkleIcon.style.marginTop = "2px";

      const suggestionText = aiSuggestionBox.createDiv();
      suggestionText.style.fontSize = "12px";
      suggestionText.style.color = "var(--text-normal)";

      const strongText = suggestionText.createEl("strong");
      strongText.setText("AI Suggestion: ");
      suggestionText.createSpan({
        text: `Create as sub-project of "${item.parentProject.title}"`,
      });
    }
  }

  // AI Suggestions for existing projects (shown when NOT creating as sub-project)
  if (
    !item.isSubProject &&
    item.isAIProcessed &&
    item.result?.suggestedProjects &&
    item.result.suggestedProjects.length > 0 &&
    item.result.suggestedProjects[0].confidence === "high" &&
    !item.result.suggestedProjects[0].asSubProject
  ) {
    const suggestion = item.result.suggestedProjects[0];
    const aiSuggestionBox = projectEl.createDiv();
    aiSuggestionBox.style.display = "flex";
    aiSuggestionBox.style.alignItems = "flex-start";
    aiSuggestionBox.style.gap = "8px";
    aiSuggestionBox.style.padding = "12px";
    aiSuggestionBox.style.backgroundColor = "rgba(255, 193, 7, 0.1)";
    aiSuggestionBox.style.border = "1px solid rgba(255, 193, 7, 0.3)";
    aiSuggestionBox.style.borderRadius = "8px";
    aiSuggestionBox.style.marginTop = "12px";

    const sparkleIcon = aiSuggestionBox.createSpan();
    sparkleIcon.setText("✨");
    sparkleIcon.style.flexShrink = "0";
    sparkleIcon.style.marginTop = "2px";

    const suggestionText = aiSuggestionBox.createDiv();
    suggestionText.style.fontSize = "12px";
    suggestionText.style.color = "var(--text-normal)";

    const strongText = suggestionText.createEl("strong");
    strongText.setText("AI Suggestion: ");
    suggestionText.createSpan({ text: suggestion.relevance });
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

  if (
    item.isAIProcessed &&
    item.result?.suggestedProjects &&
    item.result.suggestedProjects.length > 0 &&
    item.result.suggestedProjects[0].confidence === "high"
  ) {
    const suggestion = item.result.suggestedProjects[0];
    const aiSuggestionBox = projectSelectorEl.createDiv();
    aiSuggestionBox.style.display = "flex";
    aiSuggestionBox.style.alignItems = "flex-start";
    aiSuggestionBox.style.gap = "8px";
    aiSuggestionBox.style.padding = "12px";
    aiSuggestionBox.style.backgroundColor = "rgba(255, 193, 7, 0.1)";
    aiSuggestionBox.style.border = "1px solid rgba(255, 193, 7, 0.3)";
    aiSuggestionBox.style.borderRadius = "8px";
    aiSuggestionBox.style.marginTop = "12px";

    const sparkleIcon = aiSuggestionBox.createSpan();
    sparkleIcon.setText("✨");
    sparkleIcon.style.flexShrink = "0";
    sparkleIcon.style.marginTop = "2px";

    const suggestionText = aiSuggestionBox.createDiv();
    suggestionText.style.fontSize = "12px";
    suggestionText.style.color = "var(--text-normal)";

    const strongText = suggestionText.createEl("strong");
    strongText.setText("AI Suggestion: ");
    suggestionText.createSpan({
      text: `${suggestion.relevance} (${suggestion.confidence} confidence)`,
    });
  }
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

  let selectedValue = item.selectedPerson?.file || "";
  if (!selectedValue && item.isAIProcessed && item.result?.suggestedPersons) {
    const highConfidenceSuggestion = item.result.suggestedPersons.find(
      (suggestion) => suggestion.confidence === "high"
    );
    if (highConfidenceSuggestion) {
      selectedValue = highConfidenceSuggestion.person.file;
      item.selectedPerson = highConfidenceSuggestion.person;
    }
  }

  if (selectedValue && !state.existingPersons.find((person) => person.file === selectedValue)) {
    personDropdown.addOption(selectedValue, item.selectedPerson?.title || selectedValue);
  }

  personDropdown.setValue(selectedValue);
  personDropdown.onChange((value) => {
    item.selectedPerson = state.existingPersons.find((p) => p.file === value) || undefined;
  });

  // Only show AI suggestion box for high confidence suggestions
  // (Person dropdown already pre-selects high confidence suggestions above)
}

function renderSomedayReminderSection(
  container: HTMLElement,
  item: EditableItem,
  state: InboxModalState
) {
  const reminderSectionEl = container.createDiv("flow-gtd-reminder-section");
  reminderSectionEl.style.marginTop = "12px";

  const reminderLabel = reminderSectionEl.createEl("label", {
    text: "Reminder Date (Optional)",
    cls: "flow-gtd-label",
  });
  reminderLabel.style.display = "block";
  reminderLabel.style.marginBottom = "8px";
  reminderLabel.style.fontSize = "14px";
  reminderLabel.style.fontWeight = "600";
  reminderLabel.style.color = "var(--text-normal)";
  reminderLabel.style.textTransform = "none";

  const reminderInput = reminderSectionEl.createEl("input", {
    type: "date",
    cls: "flow-gtd-reminder-input",
  });
  reminderInput.style.width = "100%";
  reminderInput.style.padding = "8px 12px";
  reminderInput.style.fontSize = "14px";
  reminderInput.style.border = "1px solid var(--background-modifier-border)";
  reminderInput.style.borderRadius = "4px";
  reminderInput.style.backgroundColor = "var(--background-primary)";
  reminderInput.style.color = "var(--text-normal)";

  if (item.reminderDate) {
    reminderInput.value = item.reminderDate;
  }

  reminderInput.addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value;
    item.reminderDate = value || undefined;
  });

  const helpText = reminderSectionEl.createEl("div");
  helpText.style.fontSize = "12px";
  helpText.style.color = "var(--text-muted)";
  helpText.style.marginTop = "6px";
  helpText.setText("Set a date to be reminded about this item (works with Reminders plugin)");
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

  // Show AI recommendation if available
  if (
    item.isAIProcessed &&
    item.result?.recommendedSpheres &&
    item.result.recommendedSpheres.length > 0
  ) {
    const recommendedSphere = item.result.recommendedSpheres[0];
    if (item.selectedSpheres.includes(recommendedSphere)) {
      const recommendationText = sphereSelectorEl.createDiv();
      recommendationText.style.display = "flex";
      recommendationText.style.alignItems = "center";
      recommendationText.style.gap = "6px";
      recommendationText.style.marginTop = "8px";
      recommendationText.style.fontSize = "12px";
      recommendationText.style.color = "var(--color-green)";

      recommendationText.createSpan({ text: "✓" });
      const recommendedText = recommendationText.createSpan();
      const capitalizedRecommended =
        recommendedSphere.charAt(0).toUpperCase() + recommendedSphere.slice(1);
      recommendedText.setText(`${capitalizedRecommended} recommended based on context`);
    }
  }
}

function renderHotlistCheckbox(container: HTMLElement, item: EditableItem, state: InboxModalState) {
  const checkboxesContainer = container.createDiv("flow-gtd-action-checkboxes");
  checkboxesContainer.style.marginTop = "12px";
  checkboxesContainer.style.display = "flex";
  checkboxesContainer.style.gap = "24px";

  // Add to hotlist checkbox
  const hotlistContainer = checkboxesContainer.createDiv("flow-gtd-hotlist-checkbox");
  hotlistContainer.style.display = "flex";
  hotlistContainer.style.alignItems = "center";
  hotlistContainer.style.gap = "8px";

  const hotlistCheckbox = hotlistContainer.createEl("input", {
    type: "checkbox",
  });
  hotlistCheckbox.id = state.getUniqueId("add-to-hotlist");
  hotlistCheckbox.checked = item.addToHotlist || false;

  const hotlistLabel = hotlistContainer.createEl("label");
  hotlistLabel.setAttribute("for", hotlistCheckbox.id);
  hotlistLabel.setText("Add to hotlist");
  hotlistLabel.style.cursor = "pointer";
  hotlistLabel.style.fontSize = "14px";
  hotlistLabel.style.color = "var(--text-normal)";

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
  hotlistCheckbox.addEventListener("change", (e) => {
    const isChecked = (e.target as HTMLInputElement).checked;
    item.addToHotlist = isChecked;

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

    if (isChecked && item.addToHotlist) {
      item.addToHotlist = false;
      hotlistCheckbox.checked = false;
    }
  });
}
