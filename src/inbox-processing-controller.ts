// ABOUTME: Coordinates inbox processing: loads inbox items and reference data,
// ABOUTME: and saves or discards items by removing them from the inbox.
import { App } from "obsidian";
import { FlowProjectScanner } from "./flow-scanner";
import { PersonScanner } from "./person-scanner";
import { FileWriter } from "./file-writer";
import { FlowProject, PluginSettings, PersonNote } from "./types";
import { InboxItem, InboxScanner } from "./inbox-scanner";
import { InboxItemPersistenceService } from "./inbox-item-persistence";
import { EditableItem } from "./inbox-types";
import { filterTemplates, filterLiveProjects } from "./project-filters";

interface ControllerDependencies {
  scanner?: FlowProjectScanner;
  personScanner?: PersonScanner;
  writer?: FileWriter;
  inboxScanner?: Pick<InboxScanner, "getAllInboxItems" | "deleteInboxItem">;
  persistenceService?: InboxItemPersistenceService;
}

export class InboxProcessingController {
  private scanner: FlowProjectScanner;
  private personScanner: PersonScanner;
  private writer: FileWriter;
  private inboxScanner: InboxScanner;
  private persistence: InboxItemPersistenceService;
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
    this.inboxScanner = new InboxScanner(app, settings);
    if (dependencies.inboxScanner) {
      Object.assign(this.inboxScanner, dependencies.inboxScanner);
    }
    this.persistence =
      dependencies.persistenceService ??
      new InboxItemPersistenceService(this.writer, app, settings, saveSettings);
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

  async saveItem(item: EditableItem): Promise<void> {
    // If this is a note item, capture the source link before persisting
    if (item.inboxItem) {
      const sourceLink = await this.inboxScanner.deleteInboxItem(item.inboxItem);
      if (sourceLink) {
        item.sourceNoteLink = sourceLink;
      }
    }

    await this.persistence.persist(item);
  }

  async discardInboxItem(item: EditableItem): Promise<void> {
    if (!item.inboxItem) {
      return;
    }

    await this.inboxScanner.deleteInboxItem(item.inboxItem);
  }
}
