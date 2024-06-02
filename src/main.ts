import * as fs from 'fs'

import { Plugin, FileSystemAdapter } from 'obsidian'
import { StateManager } from './state'
import { FlowSettings, DEFAULT_SETTINGS } from './settings/settings'
import { FlowSettingsTab } from './settings/settingsTab'
import { ProcessingView, PROCESSING_VIEW_TYPE } from './views/processing'
import { ProjectView, PROJECT_VIEW_TYPE } from './views/project'

export default class FlowPlugin extends Plugin {
	private stateManager: StateManager
	private watchers: fs.FSWatcher[]
	settings: FlowSettings

	async onload() {
		await this.loadSettings()
		this.addSettingTab(new FlowSettingsTab(this.app, this))

		this.registerView(
			PROCESSING_VIEW_TYPE,
			(leaf) => new ProcessingView(leaf),
		)

		this.registerView(PROJECT_VIEW_TYPE, (leaf) => new ProjectView(leaf))

		this.stateManager = new StateManager(this)
		this.addCommand({
			id: 'process-inboxes',
			name: 'Process Inboxes',
			callback: () => this.stateManager.startProcessing(),
		})

		this.addCommand({
			id: 'view-personal-project',
			name: 'View Personal Project',
			callback: async () => {
				const existingLeaves =
					this.app.workspace.getLeavesOfType(PROJECT_VIEW_TYPE)

				for (const l of existingLeaves) {
					const projectView = l.view as ProjectView
					if (projectView.context === 'personal') {
						this.app.workspace.setActiveLeaf(l)
						return
					}
				}

				const leaf = this.app.workspace.getLeaf(false)
				await leaf.setViewState({
					type: PROJECT_VIEW_TYPE,
					active: true,
				})

				const view = leaf.view as ProjectView
				view.plugin = this
				view.context = 'personal'
				await view.render()
			},
		})

		this.registerEvent(
			this.app.workspace.on(
				'active-leaf-change',
				await this.onActiveLeafChange.bind(this),
			),
		)

		this.setupWatchers()
	}

	private async setupWatchers() {
		this.watchers = []

		const foldersToWatch = [
			this.settings.inboxFilesFolderPath,
			this.settings.inboxFolderPath,
		]

		foldersToWatch.forEach((folderPath) => {
			const folder = this.app.vault.getAbstractFileByPath(folderPath)
			if (!folder) {
				return
			}
			const folderPathFull = (
				this.app.vault.adapter as FileSystemAdapter
			).getFullPath(folder.path)

			const watcher = fs.watch(
				folderPathFull,
				{ recursive: false },
				async (eventType, filename) => {
					if (filename) {
						console.log(`Change detected in folder: ${folder}`)
						console.log(
							`File changed: ${filename}, Event type: ${eventType}`,
						)
						await this.stateManager.updateCounts()
					}
				},
			)
			this.watchers.push(watcher)
		})
	}

	async onActiveLeafChange(leaf: any) {
		if (leaf.view.getViewType() === PROCESSING_VIEW_TYPE) {
			this.stateManager.startProcessing()
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		)
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(PROCESSING_VIEW_TYPE)
		this.app.workspace.detachLeavesOfType(PROJECT_VIEW_TYPE)
		this.watchers.forEach((watcher) => watcher.close())
	}
}
