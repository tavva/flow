import { Setting, debounce } from 'obsidian'

import type FlowPlugin from 'main'
import { FileSuggest } from 'settings/suggesters/FileSuggester'
import { FolderSuggest } from 'settings/suggesters/FolderSuggester'
import { resetSphereCommands } from 'commands'

export interface SettingDefinition<T> {
	defaultValue: T
	check: (value: T, plugin: FlowPlugin) => boolean | string
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
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Line at a time')
				.setDesc(
					'Flow processes all lines in every note in this folder. We allow multiple inbox notes to help prevent syncing issues when the inbox can be populated from many different sources.',
				)
				.addSearch((cb) => {
					new FolderSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: Inbox')
						.setValue(plugin.settings.inboxFilesFolderPath)
						.onChange(async (value) => {
							plugin.settings.inboxFilesFolderPath = value
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
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Note at a time')
				.setDesc(
					'Flow processes entire notes one by one in this folder.',
				)
				.addSearch((cb) => {
					new FolderSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: Inbox')
						.setValue(plugin.settings.inboxFolderPath)
						.onChange(async (value) => {
							plugin.settings.inboxFolderPath = value
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
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Next actions')
				.setDesc(
					`This is where Flow will store Next Actions that aren't
					assigned to a project.`,
				)
				.addSearch((cb) => {
					new FileSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: Next Actions.md')
						.setValue(plugin.settings.nextActionsFilePath)
						.onChange(async (value) => {
							plugin.settings.nextActionsFilePath = value
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
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('New project template')
				.setDesc('Flow will create new projects using this template.')
				.addSearch((cb) => {
					new FileSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: templates/Project.md')
						.setValue(plugin.settings.newProjectTemplateFilePath)
						.onChange(async (value) => {
							plugin.settings.newProjectTemplateFilePath = value
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
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Projects folder')
				.setDesc('This is where your project notes are stored.')
				.addSearch((cb) => {
					new FolderSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: Projects')
						.setValue(plugin.settings.projectsFolderPath)
						.onChange(async (value) => {
							plugin.settings.projectsFolderPath = value
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
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('New person template')
				.setDesc(
					'Flow will create new person notes using this template.',
				)
				.addSearch((cb) => {
					new FileSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: templates/Person.md')
						.setValue(plugin.settings.newPersonTemplateFilePath)
						.onChange(async (value) => {
							plugin.settings.newPersonTemplateFilePath = value
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
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('People folder')
				.setDesc('This is where your people notes are stored.')
				.addSearch((cb) => {
					new FolderSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: People')
						.setValue(plugin.settings.peopleFolderPath)
						.onChange(async (value) => {
							plugin.settings.peopleFolderPath = value
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
		render: (containerEl: HTMLElement, plugin: FlowPlugin) => {
			new Setting(containerEl)
				.setName('Someday/Maybe')
				.setDesc(
					'Flow will add your someday/maybe drops using this template.',
				)
				.addSearch((cb) => {
					new FileSuggest(plugin, cb.inputEl)
					cb.setPlaceholder('Example: Someday.md')
						.setValue(plugin.settings.somedayFilePath)
						.onChange(async (value) => {
							plugin.settings.somedayFilePath = value
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
					'Flow will append this to all tasks it creates. This is useful if you use the Tasks plugin and have a global task filter set.',
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
		defaultValue: [] as string[],
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
				.setDesc('A comma-separated list of spheres.')
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
}

export type SettingsDefinitions = {
	[K in keyof typeof rawSettingsDefinitions]: SettingDefinition<any>
}

export const settingsDefinitions: SettingsDefinitions = rawSettingsDefinitions
