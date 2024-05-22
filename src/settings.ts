export interface GTDSettings {
	inboxFilePath: string
	emailInboxFolderPath: string
	nextActionsFilePath: string
}

export const DEFAULT_SETTINGS: GTDSettings = {
	inboxFilePath: 'Inbox.md',
	emailInboxFolderPath: 'EmailInbox',
	nextActionsFilePath: 'NextActions.md',
}
