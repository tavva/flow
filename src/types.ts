import { ChatMessage, ToolCall } from "./language-model";

/**
 * Valid project status values
 */
export const VALID_PROJECT_STATUSES = [
  "live",
  "active",
  "planning",
  "paused",
  "completed",
] as const;

export interface FlowProject {
  file: string;
  title: string;
  description?: string; // Content between frontmatter and ## Next actions
  tags: string[];
  priority?: number;
  status?: string;
  creationDate?: string;
  mtime?: number; // File modification time in milliseconds
  nextActions: string[];
  parentProject?: string; // Wikilink to parent project, e.g., "[[Engineering AI Strategy]]"
  milestones?: string; // Raw text from ## Milestones section
}

export interface PersonNote {
  file: string;
  title: string;
  tags: string[];
  status?: string;
  creationDate?: string;
}

export interface FocusItem {
  file: string; // Full path to source file
  lineNumber: number; // Last known line number
  lineContent: string; // Full line content for validation
  text: string; // Display text (action without checkbox)
  sphere: string; // Which sphere this belongs to
  isGeneral: boolean; // true if from Next Actions file
  addedAt: number; // Timestamp
  isPinned?: boolean; // true if item is in pinned section
  completedAt?: number; // Timestamp when marked complete
}

export type ProcessingAction =
  | "create-project"
  | "add-to-project"
  | "next-actions-file"
  | "someday-file"
  | "reference"
  | "person"
  | "trash"
  | "discard";

export interface GTDProcessingResult {
  isActionable: boolean;
  category: "next-action" | "project" | "reference" | "someday" | "person";
  projectOutcome?: string;
  projectPriority?: number;
  nextAction?: string; // Optional for non-actionable items
  nextActions?: string[]; // Support multiple next actions
  reasoning: string;
  suggestedProjects?: ProjectSuggestion[];
  suggestedPersons?: PersonSuggestion[];
  recommendedAction: ProcessingAction;
  recommendedActionReasoning: string;
  recommendedSpheres?: string[];
  recommendedSpheresReasoning?: string;
  referenceContent?: string; // Content to add as reference to a project
  isWaitingFor?: boolean; // Indicates next actions should use [w] checkbox status
  waitingForReason?: string; // Explanation of what we're waiting for
}

export interface ProjectSuggestion {
  project: FlowProject;
  relevance: string;
  confidence: "high" | "medium" | "low";
  asSubProject?: boolean; // True if this should be created as a sub-project
  parentProject?: string; // Path to parent project file if asSubProject is true
}

export interface PersonSuggestion {
  person: PersonNote;
  relevance: string;
  confidence: "high" | "medium" | "low";
}

export type LLMProvider = "anthropic" | "openai-compatible";

export interface PluginSettings {
  aiEnabled: boolean; // Master toggle for all AI functionality
  llmProvider: LLMProvider;
  anthropicApiKey: string;
  anthropicModel: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
  defaultPriority: number;
  defaultStatus: string;
  inboxFilesFolderPath: string;
  inboxFolderPath: string;
  processedInboxFolderPath: string;
  nextActionsFilePath: string;
  somedayFilePath: string;
  projectsFolderPath: string;
  projectTemplateFilePath: string;
  spheres: string[];
  focus?: FocusItem[]; // DEPRECATED: Migrated to file storage (flow/focus.json)
  focusAutoClearTime: string; // Empty string for off, or time in HH:MM format (e.g., "03:00")
  focusArchiveFile: string; // Path to archive file for cleared tasks
  lastFocusClearTimestamp: number; // Timestamp of last auto-clear
  lastFocusArchiveSucceeded: boolean; // Whether the last archive attempt succeeded
  focusClearedNotificationDismissed: boolean; // Whether user dismissed the clear notification
}

export const DEFAULT_SETTINGS: PluginSettings = {
  aiEnabled: false, // Disabled by default
  llmProvider: "openai-compatible",
  openaiApiKey: "",
  openaiBaseUrl: "https://openrouter.ai/api/v1",
  openaiModel: "google/gemini-2.5-flash",
  anthropicApiKey: "",
  anthropicModel: "claude-haiku-4-5",
  defaultPriority: 2,
  defaultStatus: "live",
  inboxFilesFolderPath: "Flow Inbox Files",
  inboxFolderPath: "Flow Inbox Folder",
  processedInboxFolderPath: "Processed Inbox Folder Notes",
  nextActionsFilePath: "Next actions.md",
  somedayFilePath: "Someday.md",
  projectsFolderPath: "Projects",
  projectTemplateFilePath: "Templates/Project.md",
  spheres: ["personal", "work"],
  focusAutoClearTime: "03:00",
  focusArchiveFile: "Focus Archive.md",
  lastFocusClearTimestamp: 0,
  lastFocusArchiveSucceeded: false,
  focusClearedNotificationDismissed: false,
};

// Project Review Types
export interface NextActionImprovement {
  current: string;
  suggested: string;
}

export interface ProjectImprovement {
  projectPath: string;
  currentName: string;
  suggestedName?: string;
  currentDescription: string;
  suggestedDescription?: string;
  nextActionImprovements?: NextActionImprovement[];
  rationale: string;
}

export interface ProjectMerge {
  primaryProject: string;
  projectsToMerge: string[];
  combinedNextActions: string[];
  rationale: string;
}

export interface ProjectStatusChange {
  projectPath: string;
  currentStatus: string;
  suggestedStatus: "complete" | "archived" | "paused";
  rationale: string;
}

export interface ProjectReviewResponse {
  projectsOk: string[];
  improvements: ProjectImprovement[];
  merges: ProjectMerge[];
  statusChanges: ProjectStatusChange[];
}

export interface ReviewProtocol {
  filename: string; // e.g., "friday-afternoon.md"
  name: string; // Extracted from first H1, fallback to filename
  trigger?: {
    day?: string; // monday, tuesday, wednesday, thursday, friday, saturday, sunday
    time?: string; // morning, afternoon, evening
  };
  spheres?: string[]; // e.g., ["work", "personal"]
  content: string; // Full markdown body (without frontmatter)
}

// Coach types
export interface CoachConversation {
  id: string; // UUID
  title: string; // Auto-generated from first message
  messages: ChatMessage[];
  systemPrompt: string; // Built once at conversation start
  createdAt: number;
  lastUpdatedAt: number;
  toolApprovalBlocks?: ToolApprovalBlock[]; // Tool calls awaiting approval or completed
  displayCards?: DisplayCard[]; // Cards to render inline with messages
  lastSeenMessageCount?: number; // Number of messages user has seen (for new message indicator)
}

export interface CoachState {
  conversations: CoachConversation[];
  activeConversationId: string | null;
}

export interface ProjectCardData {
  title: string;
  description: string;
  priority: number;
  status: string;
  nextActionsCount: number;
  file: string;
}

export interface ActionCardData {
  text: string;
  file: string;
  lineNumber: number;
  status: "incomplete" | "waiting" | "complete";
}

export type DisplayCard =
  | { type: "project"; data: ProjectCardData; messageIndex: number }
  | { type: "action"; data: ActionCardData; messageIndex: number };

export interface ToolApprovalBlock {
  toolCall: ToolCall;
  status: "pending" | "approved" | "rejected" | "error";
  result?: string;
  error?: string;
}
