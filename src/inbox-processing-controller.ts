import { App } from "obsidian";
import { FlowProjectScanner } from "./flow-scanner";
import { PersonScanner } from "./person-scanner";
import { FileWriter } from "./file-writer";
import { FlowProject, PluginSettings, PersonNote } from "./types";
import { InboxItem, InboxScanner } from "./inbox-scanner";
import { InboxItemPersistenceService } from "./inbox-item-persistence";
import { DeletionOffsetManager } from "./deletion-offset-manager";
import { EditableItem } from "./inbox-types";
import { filterTemplates, filterLiveProjects } from "./project-filters";

interface ControllerDependencies {
  scanner?: FlowProjectScanner;
  personScanner?: PersonScanner;
  writer?: FileWriter;
  inboxScanner?: Pick<InboxScanner, "getAllInboxItems" | "deleteInboxItem">;
  persistenceService?: InboxItemPersistenceService;
  deletionOffsetManagerFactory?: (offsets: Map<string, number>) => DeletionOffsetManager;
}

export class InboxProcessingController {
  private scanner: FlowProjectScanner;
  private personScanner: PersonScanner;
  private writer: FileWriter;
  private inboxScanner: InboxScanner;
  private persistence: InboxItemPersistenceService;
  private createDeletionManager: (offsets: Map<string, number>) => DeletionOffsetManager;
  private settings: PluginSettings;

  constructor(
    app: App,
    settings: PluginSettings,
    dependencies: ControllerDependencies = {},
    saveSettings?: () => Promise<void>
  ) {
    this.settings = settings;
    this.scanner = dependencies.scanner ?? new FlowProjectScanner(app);
    this.personScanner = dependencies.personScanner ?? new PersonScanner(app);
    this.writer = dependencies.writer ?? new FileWriter(app, settings);
    this.inboxScanner = (
      dependencies.inboxScanner
        ? Object.assign(new InboxScanner(app, settings), dependencies.inboxScanner)
        : new InboxScanner(app, settings)
    ) as InboxScanner;
    this.persistence =
      dependencies.persistenceService ??
      new InboxItemPersistenceService(this.writer, app, settings, saveSettings);
    this.createDeletionManager =
      dependencies.deletionOffsetManagerFactory ??
      ((offsets) => new DeletionOffsetManager(offsets));
  }

  async loadExistingProjects(): Promise<FlowProject[]> {
    const projects = await this.scanner.scanProjects();
    const withoutTemplates = filterTemplates(projects, this.settings.projectTemplateFilePath);
    return filterLiveProjects(withoutTemplates);
  }

  async loadExistingPersons(): Promise<PersonNote[]> {
    return this.personScanner.scanPersons();
  }

  async loadInboxEditableItems(): Promise<EditableItem[]> {
    const inboxItems = await this.inboxScanner.getAllInboxItems();
    return this.createEditableItemsFromInbox(inboxItems);
  }

  setInboxScanner(scanner: Partial<Pick<InboxScanner, "getAllInboxItems" | "deleteInboxItem">>) {
    this.inboxScanner = Object.assign(this.inboxScanner, scanner);
  }

  getInboxScanner(): Pick<InboxScanner, "getAllInboxItems" | "deleteInboxItem"> {
    return this.inboxScanner;
  }

  createEditableItemsFromInbox(inboxItems: InboxItem[]): EditableItem[] {
    return inboxItems.map((item) => ({
      original: item.content,
      inboxItem: item,
      selectedAction: "next-actions-file",
      selectedSpheres: this.settings.spheres.length === 1 ? [...this.settings.spheres] : [],
    }));
  }

  async saveItem(item: EditableItem, deletionOffsets: Map<string, number>): Promise<void> {
    // If this is a note item, capture the source link before persisting
    if (item.inboxItem) {
      const sourceLink = await this.removeInboxItem(item.inboxItem, deletionOffsets);
      if (sourceLink) {
        item.sourceNoteLink = sourceLink;
      }
    }

    await this.persistence.persist(item);
  }

  async discardInboxItem(item: EditableItem, deletionOffsets: Map<string, number>): Promise<void> {
    if (!item.inboxItem) {
      return;
    }

    await this.removeInboxItem(item.inboxItem, deletionOffsets);
  }

  private async removeInboxItem(
    inboxItem: InboxItem,
    deletionOffsets: Map<string, number>
  ): Promise<string | undefined> {
    const deletionManager = this.createDeletionManager(deletionOffsets);
    const inboxItemToDelete = deletionManager.prepareForDeletion(inboxItem);
    const sourceLink = await this.inboxScanner.deleteInboxItem(inboxItemToDelete);
    deletionManager.recordDeletion(inboxItem);
    return sourceLink;
  }
}
