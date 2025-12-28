// ABOUTME: Plugin settings and configuration types
// ABOUTME: Contains PluginSettings interface and default values

export type LLMProvider = "anthropic" | "openai-compatible";

export interface PluginSettings {
  aiEnabled: boolean; // Master toggle for all AI functionality
  llmProvider: LLMProvider;
  anthropicApiKey: string;
  anthropicModel: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
  openrouterImageModel: string;
  defaultPriority: number;
  defaultStatus: string;
  inboxFilesFolderPath: string;
  inboxFolderPath: string;
  processedInboxFolderPath: string;
  nextActionsHeaderText: string; // Header text to use instead of "Next actions"
  milestonesHeaderText: string; // Header text to use instead of "Milestones"
  nextActionsFilePath: string;
  somedayFilePath: string;
  projectsFolderPath: string;
  projectTemplateFilePath: string;
  defaultInboxFile: string; // Filename for built-in Flow quick capture (will be created in Flow Inbox Files folder)
  coverImagesFolderPath: string; // Folder path for generated project cover images
  autoCreateCoverImage: boolean; // Automatically create cover images for new projects
  displayCoverImages: boolean; // Display cover images on project notes
  spheres: string[];
  focusAutoClearTime: string; // Empty string for off, or time in HH:MM format (e.g., "03:00")
  focusArchiveFile: string; // Path to archive file for cleared tasks
  lastFocusClearTimestamp: number; // Timestamp of last auto-clear
  lastFocusArchiveSucceeded: boolean; // Whether the last archive attempt succeeded
  focusClearedNotificationDismissed: boolean; // Whether user dismissed the clear notification
  completedTodaySectionCollapsed: boolean; // false = expanded by default
  legacyFocusMigrationDismissed: boolean; // User chose "Don't ask again" for #flow-planned migration
  legacyFocusTagRemovalDismissed: boolean; // User chose "Keep forever" for legacy tag removal
}

export const DEFAULT_SETTINGS: PluginSettings = {
  aiEnabled: false, // Disabled by default
  llmProvider: "openai-compatible",
  openaiApiKey: "",
  openaiBaseUrl: "https://openrouter.ai/api/v1",
  openaiModel: "google/gemini-2.5-flash",
  openrouterImageModel: "google/gemini-2.5-flash-image",
  anthropicApiKey: "",
  anthropicModel: "claude-haiku-4-5",
  defaultPriority: 2,
  defaultStatus: "live",
  inboxFilesFolderPath: "Flow Inbox Files",
  inboxFolderPath: "Flow Inbox Folder",
  processedInboxFolderPath: "Processed Inbox Folder Notes",
  nextActionsFilePath: "Next actions.md",
  nextActionsHeaderText: "Next actions",
  milestonesHeaderText: "Milestones",
  somedayFilePath: "Someday.md",
  projectsFolderPath: "Projects",
  projectTemplateFilePath: "Templates/Project.md",
  defaultInboxFile: "Inbox.md",
  coverImagesFolderPath: "Assets/flow-project-cover-images",
  autoCreateCoverImage: false,
  displayCoverImages: true,
  spheres: ["personal", "work"],
  focusAutoClearTime: "03:00",
  focusArchiveFile: "Focus Archive.md",
  lastFocusClearTimestamp: 0,
  lastFocusArchiveSucceeded: false,
  focusClearedNotificationDismissed: false,
  completedTodaySectionCollapsed: false,
  legacyFocusMigrationDismissed: false,
  legacyFocusTagRemovalDismissed: false,
};

/**
 * Returns "Next actions" header text from settings if present;
 * returns a fallback text otherwise.
 */
export function nextActionsHeaderText(settings: PluginSettings): string {
  const headerText = settings.nextActionsHeaderText;
  if (headerText && headerText.trim().length > 0) {
    return headerText;
  }
  return "Next actions";
}

/**
 * Returns "Milestones" header text from settings if present;
 * returns a fallback text otherwise.
 */
export function milestonesHeaderText(settings: PluginSettings): string {
  const headerText = settings.milestonesHeaderText;
  if (headerText && headerText.trim().length > 0) {
    return headerText;
  }
  return "Milestones";
}
