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

interface FocusItemBase {
  text: string; // Display text (action without checkbox)
  sphere: string; // Which sphere this belongs to
  addedAt: number; // Timestamp
  isPinned?: boolean; // true if item is in pinned section
  completedAt?: number; // Timestamp when marked complete
  contexts?: string[]; // GTD context tags (#context/X) from the action line
}

// A Focus item that points at an action line in the vault
export interface VaultFocusItem extends FocusItemBase {
  file: string; // Full path to source file
  lineNumber: number; // Last known line number
  lineContent: string; // Full line content for validation
  isGeneral: boolean; // true if from Next Actions file
}

// A Focus item added by another plugin, with no line in the vault
export interface ExternalFocusItem extends FocusItemBase {
  id: string; // Stable ID, assigned by Flow
  external: ExternalSource;
}

export interface ExternalSource {
  sourceName: string; // Owning plugin's source, e.g. "linear"
  sourceLabel: string; // Shown as a chip, e.g. "Rootcause"
  url: string; // Opened when the item is clicked
  externalId: string; // The source's own ID, e.g. "ROO-123"
}

export type FocusItem = VaultFocusItem | ExternalFocusItem;
