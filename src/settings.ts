export interface FlowSettings {
	inboxFilePath: string
	emailInboxFolderPath: string
	nextActionsFilePath: string
	newProjectTemplateFilePath: string
	projectsFolderPath: string
}

export const DEFAULT_SETTINGS: FlowSettings = {
	inboxFilePath: 'Inbox.md',
	emailInboxFolderPath: 'EmailInbox',
	nextActionsFilePath: 'NextActions.md',
	newProjectTemplateFilePath: 'Templates/Project.md',
	projectsFolderPath: 'Projects',
}
