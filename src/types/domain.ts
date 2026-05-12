// ABOUTME: Core domain entities for Flow GTD plugin
// ABOUTME: Contains FlowProject, PersonNote, FocusItem - the fundamental data structures

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
  coverImage?: string; // Path to cover image file
  current?: boolean; // Whether project is marked as a current focus
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
  contexts?: string[]; // GTD context tags (#context/X) from the action line
}
