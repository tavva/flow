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
  editedProjectTitle?: string;
  projectPriority?: number;
  isProcessing?: boolean;
  hasAIRequest?: boolean;
}

export interface ProcessingOutcome {
  item: EditableItem;
  updatedItem?: EditableItem;
  error?: Error;
}
