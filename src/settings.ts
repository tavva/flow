export interface FlowSettings {
	inboxFilePath: string
	emailInboxFolderPath: string
	nextActionsFilePath: string
}

export const DEFAULT_SETTINGS: FlowSettings = {
	inboxFilePath: 'Inbox.md',
	emailInboxFolderPath: 'EmailInbox',
	nextActionsFilePath: 'NextActions.md',
}
