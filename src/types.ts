export interface FlowProject {
  file: string;
  title: string;
  tags: string[];
  priority?: number;
  status?: string;
  creationDate?: string;
  nextActions: string[];
}

export interface PersonNote {
  file: string;
  title: string;
  tags: string[];
  status?: string;
  creationDate?: string;
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
}

export interface ProjectSuggestion {
  project: FlowProject;
  relevance: string;
  confidence: "high" | "medium" | "low";
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
