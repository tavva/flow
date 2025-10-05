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

export interface GTDProcessingResult {
	isActionable: boolean;
	category: 'next-action' | 'project' | 'reference' | 'someday';
	projectOutcome?: string;
	nextAction: string;
	reasoning: string;
	futureActions?: string[];
	suggestedProjects?: ProjectSuggestion[];
}

export interface ProjectSuggestion {
	project: FlowProject;
	relevance: string;
	confidence: 'high' | 'medium' | 'low';
}

export interface PluginSettings {
	anthropicApiKey: string;
	defaultPriority: number;
	defaultStatus: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	anthropicApiKey: '',
	defaultPriority: 2,
	defaultStatus: 'live'
};
