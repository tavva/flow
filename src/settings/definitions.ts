import { Setting, debounce } from 'obsidian'

import type FlowPlugin from 'main'
import { FileSuggest } from 'settings/suggesters/FileSuggester'
import { FolderSuggest } from 'settings/suggesters/FolderSuggester'
import { resetSphereCommands } from 'commands'

interface SettingDefinition<T> {
	defaultValue: T
	validate: (value: T) => boolean
	check?: (value: T, plugin: FlowPlugin) => boolean
	render: (containerEl: HTMLElement, plugin: FlowPlugin) => void
}

export const rawSettingsDefinitions = {
	inboxFilesFolderPath: {
		defaultValue: '/default/path/inboxFiles',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		check: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFolderByPath(value) !== null,
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
		defaultValue: '/default/path/inbox',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		check: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFolderByPath(value) !== null,
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
		defaultValue: '/default/path/nextActions',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		check: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFileByPath(value) !== null,
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
		defaultValue: '/default/path/newProjectTemplate',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		check: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFileByPath(value) !== null,
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
		defaultValue: '/default/path/projects',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		check: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFolderByPath(value) !== null,
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
		defaultValue: '/default/path/newPersonTemplate',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		check: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFileByPath(value) !== null,
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
		defaultValue: '/default/path/people',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		check: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFolderByPath(value) !== null,
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
		defaultValue: '/default/path/someday',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		check: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFileByPath(value) !== null,
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
		validate: (value: string) => typeof value === 'string',
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
		validate: (value: string[]) =>
			Array.isArray(value) &&
			value.every((item) => typeof item === 'string'),
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

type SettingsDefinitions = {
	[K in keyof typeof rawSettingsDefinitions]: SettingDefinition<any>
}

export const settingsDefinitions: SettingsDefinitions = rawSettingsDefinitions
