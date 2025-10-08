export interface FlowProject {
	file: string;
	title: string;
	tags: string[];
	priority?: number;
	status?: string;
	creationDate?: string;
	nextActions: string[];
	futureNextActions: string[];
}

export interface PersonNote {
	file: string;
	title: string;
	tags: string[];
	status?: string;
	creationDate?: string;
}

export type ProcessingAction =
	| 'create-project'
	| 'add-to-project'
	| 'next-actions-file'
	| 'someday-file'
	| 'reference'
	| 'person'
	| 'trash';

export interface GTDProcessingResult {
	isActionable: boolean;
	category: 'next-action' | 'project' | 'reference' | 'someday' | 'person';
	projectOutcome?: string;
	nextAction?: string; // Optional for non-actionable items
	nextActions?: string[]; // Support multiple next actions
	reasoning: string;
	futureActions?: string[];
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
	confidence: 'high' | 'medium' | 'low';
}

export interface PersonSuggestion {
	person: PersonNote;
	relevance: string;
	confidence: 'high' | 'medium' | 'low';
}

export interface PluginSettings {
        anthropicApiKey: string;
        anthropicModel: string;
        defaultPriority: number;
        defaultStatus: string;
        inboxFilesFolderPath: string;
        inboxFolderPath: string;
        nextActionsFilePath: string;
	somedayFilePath: string;
	projectsFolderPath: string;
	spheres: string[];
}

export const DEFAULT_SETTINGS: PluginSettings = {
        anthropicApiKey: '',
        anthropicModel: 'claude-sonnet-4-20250514',
        defaultPriority: 2,
        defaultStatus: 'live',
        inboxFilesFolderPath: 'Flow Inbox Files',
        inboxFolderPath: 'Flow Inbox Folder',
	nextActionsFilePath: 'Next actions.md',
	somedayFilePath: 'Someday.md',
	projectsFolderPath: 'Projects',
	spheres: ['personal', 'work']
};
