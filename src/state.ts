import { App, TFile, TFolder } from 'obsidian'

export class StateManager {
	// TODO: pass in plugin for settings
	private app: App
	private inboxFile: TFile
	private emailInboxFolder: TFolder

	constructor(app: App, plugin: Plugin) {
		this.app = app
		this.inboxFile = this.app.vault.getAbstractFileByPath(
			'Inbox.md', // TODO: use settings
		) as TFile
		this.emailInboxFolder = this.app.vault.getAbstractFileByPath(
			'EmailInbox', // TODO: use settings
		) as TFolder
	}

	isInboxEmpty(): boolean {}

	isEmailInboxEmpty(): boolean {}

	startProcessing() {}
}
