export interface FlowSettings {
	inboxFilesFolderPath: string
	inboxFolderPath: string
	nextActionsFilePath: string
	newProjectTemplateFilePath: string
	projectsFolderPath: string
	appendTask: string

	contexts: string[]
}

export const DEFAULT_SETTINGS: FlowSettings = {
	inboxFilesFolderPath: 'Flow Inbox Files',
	inboxFolderPath: 'Flow Inbox Folder',
	nextActionsFilePath: 'Next Actions.md',
	newProjectTemplateFilePath: 'Templates/Project.md',
	projectsFolderPath: 'Projects',
	appendTask: '',

	contexts: ['personal', 'work'],
}
