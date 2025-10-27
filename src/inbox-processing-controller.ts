import { App } from "obsidian";
import { GTDProcessor } from "./gtd-processor";
import { FlowProjectScanner } from "./flow-scanner";
import { PersonScanner } from "./person-scanner";
import { FileWriter } from "./file-writer";
import { FlowProject, PluginSettings, PersonNote } from "./types";
import { InboxItem, InboxScanner } from "./inbox-scanner";
import { LanguageModelClient } from "./language-model";
import { createLanguageModelClient, getModelForSettings } from "./llm-factory";
import { InboxItemPersistenceService } from "./inbox-item-persistence";
import { DeletionOffsetManager } from "./deletion-offset-manager";
import { buildProjectTitlePrompt as defaultProjectTitlePromptBuilder } from "./project-title-prompt";
import { EditableItem, ProcessingOutcome } from "./inbox-types";
import { filterTemplates, filterLiveProjects } from "./project-filters";

interface ControllerDependencies {
  processor?: GTDProcessor;
  client?: LanguageModelClient;
  scanner?: FlowProjectScanner;
  personScanner?: PersonScanner;
  writer?: FileWriter;
  inboxScanner?: Pick<InboxScanner, "getAllInboxItems" | "deleteInboxItem">;
  persistenceService?: InboxItemPersistenceService;
  deletionOffsetManagerFactory?: (offsets: Map<string, number>) => DeletionOffsetManager;
  projectTitlePromptBuilder?: (originalItem: string) => string;
}

export class InboxProcessingController {
  private processor: GTDProcessor;
  private scanner: FlowProjectScanner;
  private personScanner: PersonScanner;
  private writer: FileWriter;
  private inboxScanner: InboxScanner;
  private persistence: InboxItemPersistenceService;
  private createDeletionManager: (offsets: Map<string, number>) => DeletionOffsetManager;
  private projectTitlePromptBuilder: (originalItem: string) => string;
  private settings: PluginSettings;

  constructor(
    app: App,
    settings: PluginSettings,
    dependencies: ControllerDependencies = {},
    saveSettings?: () => Promise<void>
  ) {
    this.settings = settings;
    this.processor =
      dependencies.processor ??
      new GTDProcessor(
        dependencies.client ?? createLanguageModelClient(settings),
        settings.spheres,
        getModelForSettings(settings),
        settings.projectTemplateFilePath
      );
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
    this.projectTitlePromptBuilder =
      dependencies.projectTitlePromptBuilder ?? defaultProjectTitlePromptBuilder;
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
      isAIProcessed: false,
      hasAIRequest: false,
      selectedAction: "next-actions-file",
      selectedSpheres: [],
    }));
  }

  async refineItem(
    item: EditableItem,
    existingProjects: FlowProject[],
    existingPersons: PersonNote[] = []
  ): Promise<EditableItem> {
    const result = await this.processor.processInboxItem(
      item.original,
      existingProjects,
      existingPersons
    );

    const editedNames =
      result.nextActions && result.nextActions.length > 1 ? [...result.nextActions] : undefined;

    return {
      ...item,
      result,
      isAIProcessed: true,
      isProcessing: false,
      selectedProject:
        result.suggestedProjects && result.suggestedProjects.length > 0
          ? result.suggestedProjects[0].project
          : undefined,
      selectedAction: result.recommendedAction,
      selectedSpheres: result.recommendedSpheres || [],
      editedNames,
    };
  }

  async refineItems(
    items: EditableItem[],
    existingProjects: FlowProject[],
    existingPersons: PersonNote[] = []
  ): Promise<ProcessingOutcome[]> {
    const promises = items.map(async (item) => {
      try {
        const updatedItem = await this.refineItem(item, existingProjects, existingPersons);
        return { item, updatedItem } as ProcessingOutcome;
      } catch (error) {
        return { item, error: error instanceof Error ? error : new Error(String(error)) };
      }
    });

    const outcomes = await Promise.all(promises);
    console.log(`Completed processing ${items.length} items.`);
    return outcomes;
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

  async suggestProjectName(originalItem: string): Promise<string> {
    const prompt = this.projectTitlePromptBuilder(originalItem);
    const response = await this.processor.callAI(prompt);
    return response.trim();
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
