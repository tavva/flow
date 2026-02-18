import { App, Notice } from "obsidian";
import { FlowProject, PersonNote, PluginSettings } from "./types";
import { InboxProcessingController } from "./inbox-processing-controller";
import { EditableItem } from "./inbox-types";
import { InboxScanner } from "./inbox-scanner";
import { GTDResponseValidationError } from "./errors";
import { getActionLabel } from "./inbox-modal-utils";

export type RenderTarget = "inbox" | "editable";

export type RenderCallback = (target: RenderTarget, options?: { immediate?: boolean }) => void;

export class InboxModalState {
  public app!: App;
  public editableItems: EditableItem[] = [];
  public deletionOffsets = new Map<string, number>();
  public existingProjects: FlowProject[] = [];
  public existingPersons: PersonNote[] = [];
  public isLoadingInbox = true;

  private uniqueIdCounter = 0;

  constructor(
    private readonly controller: InboxProcessingController,
    private readonly settings: PluginSettings,
    private readonly requestRender: RenderCallback
  ) {}

  get inboxScanner(): Pick<InboxScanner, "getAllInboxItems" | "deleteInboxItem"> {
    return this.controller.getInboxScanner();
  }

  set inboxScanner(scanner: Partial<Pick<InboxScanner, "getAllInboxItems" | "deleteInboxItem">>) {
    this.controller.setInboxScanner(scanner);
  }

  get settingsSnapshot(): PluginSettings {
    return this.settings;
  }

  getUniqueId(prefix: string): string {
    this.uniqueIdCounter += 1;
    return `${prefix}-${this.uniqueIdCounter}`;
  }

  requestImmediateRender(target: RenderTarget) {
    this.requestRender(target, { immediate: true });
  }

  queueRender(target: RenderTarget) {
    this.requestRender(target);
  }

  async loadReferenceData() {
    try {
      this.existingProjects = await this.controller.loadExistingProjects();
      this.existingPersons = await this.controller.loadExistingPersons();
    } catch (error) {
      new Notice("Failed to load existing projects and persons");
      console.error(error);
    }
  }

  async loadInboxItems() {
    try {
      const inboxEditableItems = await this.controller.loadInboxEditableItems();

      this.isLoadingInbox = false;

      if (inboxEditableItems.length === 0) {
        new Notice("No items found in inbox folders");
        this.requestRender("inbox");
        return;
      }

      this.editableItems = inboxEditableItems;
      this.initializeExpandedState();
      new Notice(`Loaded ${inboxEditableItems.length} items from inbox`);
      this.requestRender("editable");
    } catch (error) {
      this.isLoadingInbox = false;
      new Notice("Error loading inbox items");
      console.error(error);
      this.requestRender("inbox");
    }
  }

  initializeExpandedState() {
    if (this.editableItems.length > 0) {
      this.editableItems[0].isExpanded = true;
      for (let i = 1; i < this.editableItems.length; i++) {
        this.editableItems[i].isExpanded = false;
      }
    }
  }

  expandItem(item: EditableItem) {
    for (const editableItem of this.editableItems) {
      editableItem.isExpanded = editableItem === item;
    }
    this.queueRender("editable");
  }

  async saveAndRemoveItem(item: EditableItem) {
    try {
      await this.controller.saveItem(item, this.deletionOffsets);
      this.editableItems = this.editableItems.filter((current) => current !== item);

      // Auto-expand the first remaining item
      if (this.editableItems.length > 0) {
        this.editableItems[0].isExpanded = true;
      }

      // If we created a new project, refresh the project list so subsequent items can see it
      // Small delay to let Obsidian's metadata cache update after file creation
      if (item.selectedAction === "create-project") {
        await new Promise((resolve) => setTimeout(resolve, 100));
        await this.loadReferenceData();
      }

      const actionLabel = getActionLabel(item.selectedAction);
      new Notice(`✅ Saved: ${actionLabel}`);
      this.requestRender("editable");
    } catch (error) {
      if (error instanceof GTDResponseValidationError) {
        new Notice(`Cannot save: ${error.message}`);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(`Error saving item: ${message}`);
      }
      console.error(error);
    }
  }

  confirmAndDiscardItem(item: EditableItem) {
    const confirmed = confirm(
      "Are you sure you want to discard this item? This action cannot be undone."
    );
    if (confirmed) {
      this.discardItem(item);
    }
  }

  async discardItem(item: EditableItem) {
    if (item.inboxItem) {
      try {
        await this.controller.discardInboxItem(item, this.deletionOffsets);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(`Error discarding item: ${message}`);
        console.error(error);
        return;
      }
    }

    this.editableItems = this.editableItems.filter((current) => current !== item);

    // Auto-expand the first remaining item
    if (this.editableItems.length > 0) {
      this.editableItems[0].isExpanded = true;
    }

    new Notice(`🗑️ Discarded item`);
    this.requestRender("editable");
  }

  async saveAllItems() {
    if (this.editableItems.length === 0) {
      new Notice("No items to save");
      return;
    }

    new Notice(`Saving ${this.editableItems.length} remaining items...`);
    this.deletionOffsets.clear();

    const itemsToSave = [...this.editableItems];
    for (const item of itemsToSave) {
      await this.saveAndRemoveItem(item);
    }
  }
}
