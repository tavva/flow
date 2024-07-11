import type FlowPlugin from 'main'

export const settingsDefinitions = {
	inboxFilesFolderPath: {
		defaultValue: '/default/path/inboxFiles',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		checkExists: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFolderByPath(value) !== null,
	},
	inboxFolderPath: {
		defaultValue: '/default/path/inbox',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		checkExists: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFolderByPath(value) !== null,
	},
	nextActionsFilePath: {
		defaultValue: '/default/path/nextActions',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		checkExists: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFileByPath(value) !== null,
	},
	newProjectTemplateFilePath: {
		defaultValue: '/default/path/newProjectTemplate',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		checkExists: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFileByPath(value) !== null,
	},
	projectsFolderPath: {
		defaultValue: '/default/path/projects',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		checkExists: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFolderByPath(value) !== null,
	},
	newPersonTemplateFilePath: {
		defaultValue: '/default/path/newPersonTemplate',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		checkExists: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFileByPath(value) !== null,
	},
	peopleFolderPath: {
		defaultValue: '/default/path/people',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		checkExists: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFolderByPath(value) !== null,
	},
	somedayFilePath: {
		defaultValue: '/default/path/someday',
		validate: (value: string) =>
			typeof value === 'string' && value.length > 0,
		checkExists: (value: string, plugin: FlowPlugin) =>
			plugin.app.vault.getFileByPath(value) !== null,
	},
	appendTask: {
		defaultValue: '',
		validate: (value: string) => typeof value === 'string',
	},
	spheres: {
		defaultValue: [] as string[],
		validate: (value: string[]) =>
			Array.isArray(value) &&
			value.every((item) => typeof item === 'string'),
	},
}
