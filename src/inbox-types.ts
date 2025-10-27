import { InboxItem } from "./inbox-scanner";
import { FlowProject, GTDProcessingResult, ProcessingAction, PersonNote } from "./types";

export interface EditableItem {
  original: string;
  inboxItem?: InboxItem;
  isAIProcessed: boolean;
  result?: GTDProcessingResult;
  selectedProject?: FlowProject;
  selectedPerson?: PersonNote;
  selectedAction: ProcessingAction;
  selectedSpheres: string[];
  editedName?: string;
  editedNames?: string[]; // Support multiple edited next actions
  waitingFor?: boolean[]; // Track waiting-for status for each next action
  markAsDone?: boolean[]; // Track mark-as-done status for each next action
  editedProjectTitle?: string;
  projectPriority?: number;
  isProcessing?: boolean;
  hasAIRequest?: boolean;
  parentProject?: FlowProject; // Parent project if creating as sub-project
  isSubProject?: boolean; // Whether to create as sub-project
  addToFocus?: boolean; // Whether to add next actions to focus after creation
  dueDate?: string; // Optional date in YYYY-MM-DD format (due date, reminder, or follow-up depending on context)
  isDateSectionExpanded?: boolean; // Whether the date section UI is expanded
}

export interface ProcessingOutcome {
  item: EditableItem;
  updatedItem?: EditableItem;
  error?: Error;
}
