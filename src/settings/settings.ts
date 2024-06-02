export interface FlowSettings {
	inboxFileFolderPath: string
	inboxFolderPath: string
	nextActionsFilePath: string
	newProjectTemplateFilePath: string
	projectsFolderPath: string
	appendTask: string

	contexts: string[]
}

export const DEFAULT_SETTINGS: FlowSettings = {
	inboxFileFolderPath: 'Flow Inbox Files',
	inboxFolderPath: 'Flow Inbox Folder',
	nextActionsFilePath: 'Next Actions.md',
	newProjectTemplateFilePath: 'Templates/Project.md',
	projectsFolderPath: 'Projects',
	appendTask: '',

	contexts: ['personal', 'work'],
}
