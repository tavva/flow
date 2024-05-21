import { Notice, Plugin, WorkspaceLeaf, TFile } from 'obsidian'

import { GTDSettings, DEFAULT_SETTINGS, GTDSettingsTab } from './settings'

import { openFile } from './utils'
import {
	ProcessInboxesView,
	PROCESS_INBOXES_VIEW,
	ProcessEmailInboxView,
	PROCESS_EMAIL_INBOX_VIEW,
} from './views'
import { processInboxFile, processEmailInbox } from './process'

export default class GTDPlugin extends Plugin {
	settings: GTDSettings

	async onload(): Promise<void> {
		await this.loadSettings()
		this.addSettingTab(new GTDSettingsTab(this.app, this))

		this.registerView(
			PROCESS_INBOXES_VIEW,
			(leaf) => new ProcessInboxesView(leaf, this),
		)
		this.registerView(
			PROCESS_EMAIL_INBOX_VIEW,
			(leaf) => new ProcessEmailInboxView(leaf, this),
		)

		this.addCommand({
			id: 'process-inboxes',
			name: 'Process inboxes',
			callback: this.processInboxes.bind(this),
		})

		// TODO: make this flow part of the entire process inboxes flow
		this.addCommand({
			id: 'process-email-inbox',
			name: 'Process email inbox',
			callback: this.processEmailInbox.bind(this),
		})
	}

	async onunload(): Promise<void> {}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		)
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings)
	}

	private async startProcess(
		view: string,
		processMethod: () => Promise<void>,
	): Promise<void> {
		const { workspace } = this.app

		let leaf: WorkspaceLeaf | null = null
		const leaves = workspace.getLeavesOfType(view)

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0]
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false)
			await leaf.setViewState({
				type: view,
				active: true,
			})
		}

		processMethod(this)

		// Open sidebar if collapsed
		workspace.revealLeaf(leaf)
	}

	private async processInboxes(): Promise<void> {
		console.log('Processing inboxes...')
		this.startProcess(PROCESS_INBOXES_VIEW, processInboxFile)
	}

	private async processEmailInbox(): Promise<void> {
		console.log('Processing email inbox...')
		this.startProcess(PROCESS_EMAIL_INBOX_VIEW, processEmailInbox)
	}
}
