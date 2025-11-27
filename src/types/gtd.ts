// ABOUTME: GTD processing types for AI-powered inbox analysis
// ABOUTME: Contains result structures from LLM processing and suggestions

import { FlowProject, PersonNote } from "./domain";

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
