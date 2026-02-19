// ABOUTME: Plugin settings and configuration types
// ABOUTME: Contains PluginSettings interface and default values

export interface PluginSettings {
  aiEnabled: boolean; // Master toggle for all AI functionality
  openrouterApiKey: string;
  openrouterBaseUrl: string;
  openrouterImageModel: string;
  defaultPriority: number;
  defaultStatus: string;
  inboxFilesFolderPath: string;
  inboxFolderPath: string;
  processedInboxFolderPath: string;
  nextActionsFilePath: string;
  somedayFilePath: string;
  projectsFolderPath: string;
  projectTemplateFilePath: string;
  personTemplateFilePath: string;
  defaultInboxFile: string; // Filename for built-in Flow quick capture (will be created in Flow Inbox Files folder)
  coverImagesFolderPath: string; // Folder path for generated project cover images
  autoCreateCoverImage: boolean; // Automatically create cover images for new projects
  displayCoverImages: boolean; // Display cover images on project notes
  contextTagPrefix: string; // Prefix for GTD context tags (e.g. #context/home)
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
  openrouterApiKey: "",
  openrouterBaseUrl: "https://openrouter.ai/api/v1",
  openrouterImageModel: "google/gemini-2.5-flash-image",
  defaultPriority: 2,
  defaultStatus: "live",
  inboxFilesFolderPath: "Flow Inbox Files",
  inboxFolderPath: "Flow Inbox Folder",
  processedInboxFolderPath: "Processed Inbox Folder Notes",
  nextActionsFilePath: "Next actions.md",
  somedayFilePath: "Someday.md",
  projectsFolderPath: "Projects",
  projectTemplateFilePath: "Templates/Project.md",
  personTemplateFilePath: "Templates/Person.md",
  defaultInboxFile: "Inbox.md",
  coverImagesFolderPath: "Assets/flow-project-cover-images",
  autoCreateCoverImage: false,
  displayCoverImages: true,
  contextTagPrefix: "context",
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
