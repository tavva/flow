import { Setting, debounce, normalizePath } from 'obsidian'

import type FlowPlugin from 'main.js'
import { FileSuggest } from 'settings/suggesters/FileSuggester.js'
import { FolderSuggest } from 'settings/suggesters/FolderSuggester.js'
import { resetSphereCommands } from 'commands.js'

import { projectTemplateContents } from 'templates/Project.js'
import { personTemplateContents } from 'templates/Person.js'
import { createFoldersAndFile } from 'utils.js'

export interface SettingDefinition<T> {
	defaultValue: T
	check: (value: T, plugin: FlowPlugin) => boolean | string
	create?: (plugin: FlowPlugin) => void
	render: (containerEl: HTMLElement, plugin: FlowPlugin) => void
}

export const rawSettingsDefinitions = {
	inboxFilesFolderPath: {
		defaultValue: 'Flow Inbox Files',
		check: (value: string, plugin: FlowPlugin) => {
			if (plugin.app.vault.getFolderByPath(value) !== null) {
				return true
			} else {
				return `Your inbox folder (${value}) doesn't exist.`
			}
		},
		create: (plugin: FlowPlugin) => {
			plugin.app.vault.createFolder(plugin.settings.inboxFilesFolderPath)
		},
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Line at a time')
				.setDesc(
					'Flow processes all lines in every note in this folder. We allow multiple inbox notes to help prevent syncing issues when the inbox can be populated from many different sources',
				)
				.addSearch((cb) => {
					new FolderSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: Inbox')
						.setValue(plugin.settings.inboxFilesFolderPath)
						.onChange(async (value) => {
							plugin.settings.inboxFilesFolderPath =
								normalizePath(value)
							plugin.saveSettings()
						})
				})
		},
	},

	inboxFolderPath: {
		defaultValue: 'Flow Inbox Folder',
		check: (value: string, plugin: FlowPlugin) => {
			if (plugin.app.vault.getFolderByPath(value) !== null) {
				return true
			} else {
				return `Your inbox files folder (${value}) doesn't exist.`
			}
		},
		create: (plugin: FlowPlugin) => {
			plugin.app.vault.createFolder(plugin.settings.inboxFolderPath)
		},
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Note at a time')
				.setDesc(
					'Flow processes entire notes one by one in this folder',
				)
				.addSearch((cb) => {
					new FolderSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: Inbox')
						.setValue(plugin.settings.inboxFolderPath)
						.onChange(async (value) => {
							plugin.settings.inboxFolderPath =
								normalizePath(value)
							plugin.saveSettings()
						})
				})
		},
	},
	nextActionsFilePath: {
		defaultValue: 'Next actions.md',
		check: (value: string, plugin: FlowPlugin) => {
			if (plugin.app.vault.getFileByPath(value) !== null) {
				return true
			} else {
				return `You have no next actions file (${value}).`
			}
		},
		create: (plugin: FlowPlugin) => {
			plugin.app.vault.create(plugin.settings.nextActionsFilePath, '')
		},
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Next actions')
				.setDesc(
					`This is where Flow will store Next Actions that aren't
					assigned to a project`,
				)
				.addSearch((cb) => {
					new FileSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: Next Actions.md')
						.setValue(plugin.settings.nextActionsFilePath)
						.onChange(async (value) => {
							plugin.settings.nextActionsFilePath =
								normalizePath(value)
							await plugin.saveSettings()
						})
				})
		},
	},
	newProjectTemplateFilePath: {
		defaultValue: 'Templates/Project.md',
		check: (value: string, plugin: FlowPlugin) => {
			if (plugin.app.vault.getFileByPath(value) !== null) {
				return true
			} else {
				return `You have no project template (${value}).`
			}
		},
		create: async (plugin: FlowPlugin) => {
			const filePath = plugin.settings.newProjectTemplateFilePath
			const fileExists = await plugin.app.vault.adapter.exists(filePath)
			if (fileExists) {
				console.error(
					'Not creating new project template, file already exists.',
				)
				return
			}

			await createFoldersAndFile(
				filePath,
				projectTemplateContents,
				plugin,
			)
		},
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('New project template')
				.setDesc('Flow will create new projects using this template')
				.addSearch((cb) => {
					new FileSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: templates/Project.md')
						.setValue(plugin.settings.newProjectTemplateFilePath)
						.onChange(async (value) => {
							plugin.settings.newProjectTemplateFilePath =
								normalizePath(value)
							await plugin.saveSettings()
						})
				})
		},
	},
	projectsFolderPath: {
		defaultValue: 'Projects',
		check: (value: string, plugin: FlowPlugin) => {
			if (plugin.app.vault.getFolderByPath(value) !== null) {
				return true
			} else {
				return `You have no projects folder (${value}).`
			}
		},
		create: (plugin: FlowPlugin) => {
			plugin.app.vault.createFolder(plugin.settings.projectsFolderPath)
		},
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Projects folder')
				.setDesc('This is where your project notes are stored')
				.addSearch((cb) => {
					new FolderSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: Projects')
						.setValue(plugin.settings.projectsFolderPath)
						.onChange(async (value) => {
							plugin.settings.projectsFolderPath =
								normalizePath(value)
							plugin.saveSettings()
						})
				})
		},
	},
	newPersonTemplateFilePath: {
		defaultValue: 'Templates/Person.md',
		check: (value: string, plugin: FlowPlugin) => {
			if (plugin.app.vault.getFileByPath(value) !== null) {
				return true
			} else {
				return `You have no person template (${value}).`
			}
		},
		create: async (plugin: FlowPlugin) => {
			const filePath = plugin.settings.newPersonTemplateFilePath
			const fileExists = await plugin.app.vault.adapter.exists(filePath)
			if (fileExists) {
				console.error(
					'Not creating new person template, file already exists.',
				)
				return
			}

			await createFoldersAndFile(filePath, personTemplateContents, plugin)
		},
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('New person template')
				.setDesc(
					'Flow will create new person notes using this template',
				)
				.addSearch((cb) => {
					new FileSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: templates/Person.md')
						.setValue(plugin.settings.newPersonTemplateFilePath)
						.onChange(async (value) => {
							plugin.settings.newPersonTemplateFilePath =
								normalizePath(value)
							await plugin.saveSettings()
						})
				})
		},
	},
	peopleFolderPath: {
		defaultValue: 'People',
		check: (value: string, plugin: FlowPlugin) => {
			if (plugin.app.vault.getFolderByPath(value) !== null) {
				return true
			} else {
				return `You have no people folder (${value}).`
			}
		},
		create: (plugin: FlowPlugin) => {
			plugin.app.vault.createFolder(plugin.settings.peopleFolderPath)
		},
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('People folder')
				.setDesc('This is where your people notes are stored')
				.addSearch((cb) => {
					new FolderSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: People')
						.setValue(plugin.settings.peopleFolderPath)
						.onChange(async (value) => {
							plugin.settings.peopleFolderPath =
								normalizePath(value)
							plugin.saveSettings()
						})
				})
		},
	},
	somedayFilePath: {
		defaultValue: 'Someday.md',
		check: (value: string, plugin: FlowPlugin) => {
			if (plugin.app.vault.getFileByPath(value) !== null) {
				return true
			} else {
				return `You have no someday/maybe file (${value}).`
			}
		},
		create: (plugin: FlowPlugin) => {
			plugin.app.vault.create(plugin.settings.somedayFilePath, '')
		},
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Someday/Maybe')
				.setDesc(
					'Flow will add your someday/maybe drops using this template',
				)
				.addSearch((cb) => {
					new FileSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: Someday.md')
						.setValue(plugin.settings.somedayFilePath)
						.onChange(async (value) => {
							plugin.settings.somedayFilePath =
								normalizePath(value)
							await plugin.saveSettings()
						})
				})
		},
	},
	appendTagToTask: {
		defaultValue: '',
		check: (_value: string, _plugin: FlowPlugin) => true,
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Append to task')
				.setDesc(
					'Flow will append this to all tasks it creates. This is useful if you use the Tasks plugin and have a global task filter set',
				)
				.addText((text) => {
					text.setPlaceholder('Enter text to append to tasks')
						.setValue(plugin.settings.appendTagToTask)
						.onChange(async (value) => {
							plugin.settings.appendTagToTask = value
							await plugin.saveSettings()
						})
				})
		},
	},
	spheres: {
		defaultValue: ['personal', 'work'],
		check: (value: string[], _plugin: FlowPlugin) => {
			if (value.length > 0) {
				return true
			} else {
				return 'You need to set at least one sphere to use Flow.'
			}
		},
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Spheres')
				.setDesc('A comma-separated list of spheres')
				.addText((text) =>
					text
						.setPlaceholder('Enter spheres')
						.setValue(plugin.settings.spheres.join(','))
						.onChange(
							debounce(async (value) => {
								if (!value.trim()) {
									text.setValue(
										plugin.settings.spheres.join(','),
									)
									return
								}

								plugin.settings.spheres = value
									.split(',')
									.map((sphere) => sphere.trim())

								await plugin.saveSettings()
								await resetSphereCommands(plugin)
							}, 5000),
						),
				)
		},
	},
	hijackNewTab: {
		defaultValue: false,
		check: (_value: boolean, _plugin: FlowPlugin) => {
			return true
		},
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Replace new tab')
				.setDesc(
					'Flow can replace your new tab with Flow-specific information',
				)
				.addToggle((toggle) => {
					toggle
						.setValue(plugin.settings.hijackNewTab)
						.onChange(async (value) => {
							plugin.settings.hijackNewTab = value
							await plugin.saveSettings()
						})
				})
		},
	},
	automaticallyDeleteOldTasks: {
		defaultValue: false,
		check: (_value: boolean, _plugin: FlowPlugin) => {
			return true
		},
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Maintain a fresh todo list')
				.setDesc(
					'Flow can automatically delete tasks that are no longer relevant. We recommend you turn this on as your todo list should not be long-living, but it can be unnerving at first which is why this is off by default. Note that deleted tasks are saved so you can replan them if needed',
				)
				.addToggle((toggle) => {
					toggle
						.setValue(plugin.settings.automaticallyDeleteOldTasks)
						.onChange(async (value) => {
							plugin.settings.automaticallyDeleteOldTasks = value
							await plugin.saveSettings()
						})
				})
		},
	},
	exportPlannedTasks: {
		defaultValue: false,
		check: (_value: boolean, _plugin: FlowPlugin) => {
			return true
		},
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Export planned tasks')
				.setDesc(
					'Flow can export your planned tasks to a single note. This can be used to sync with other apps (e.g. for displaying your planned actions in a desktop widget',
				)
				.addToggle((toggle) => {
					toggle
						.setValue(plugin.settings.exportPlannedTasks)
						.onChange(async (value) => {
							plugin.settings.exportPlannedTasks = value
							await plugin.saveSettings()
						})
				})
		},
	},
}

export type SettingsDefinitions = {
	[K in keyof typeof rawSettingsDefinitions]: SettingDefinition<any>
}

export const settingsDefinitions: SettingsDefinitions = rawSettingsDefinitions
