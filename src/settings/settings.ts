export interface FlowSettings {
	inboxFilePath: string
	inboxFolderPath: string
	nextActionsFilePath: string
	newProjectTemplateFilePath: string
	projectsFolderPath: string
	appendTask: string
}

export const DEFAULT_SETTINGS: FlowSettings = {
	inboxFilePath: 'Flow Inbox.md',
	inboxFolderPath: 'Flow Inbox Folder',
	nextActionsFilePath: 'Next Actions.md',
	newProjectTemplateFilePath: 'Templates/Project.md',
	projectsFolderPath: 'Projects',
	appendTask: '',
}
