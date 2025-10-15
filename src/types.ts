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
}

export interface PersonNote {
  file: string;
  title: string;
  tags: string[];
  status?: string;
  creationDate?: string;
}

export interface HotlistItem {
  file: string; // Full path to source file
  lineNumber: number; // Last known line number
  lineContent: string; // Full line content for validation
  text: string; // Display text (action without checkbox)
  sphere: string; // Which sphere this belongs to
  isGeneral: boolean; // true if from Next Actions file
  addedAt: number; // Timestamp
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
  nextActionsFilePath: string;
  somedayFilePath: string;
  projectsFolderPath: string;
  projectTemplateFilePath: string;
  spheres: string[];
  hotlist: HotlistItem[];
}

export const DEFAULT_SETTINGS: PluginSettings = {
  llmProvider: "openai-compatible",
  openaiApiKey: "",
  openaiBaseUrl: "https://openrouter.ai/api/v1",
  openaiModel: "openrouter/anthropic/claude-3.5-sonnet",
  anthropicApiKey: "",
  anthropicModel: "google/gemini-2.5-flash",
  defaultPriority: 2,
  defaultStatus: "live",
  inboxFilesFolderPath: "Flow Inbox Files",
  inboxFolderPath: "Flow Inbox Folder",
  nextActionsFilePath: "Next actions.md",
  somedayFilePath: "Someday.md",
  projectsFolderPath: "Projects",
  projectTemplateFilePath: "Templates/Project.md",
  spheres: ["personal", "work"],
  hotlist: [],
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
