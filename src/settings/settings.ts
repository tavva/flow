export interface FlowSettings {
	inboxFilesFolderPath: string
	inboxFolderPath: string
	nextActionsFilePath: string
	newProjectTemplateFilePath: string
	projectsFolderPath: string
	newPersonTemplateFilePath: string
	peopleFolderPath: string
	somedayFilePath: string
	appendTask: string

	spheres: string[]
}

export const DEFAULT_SETTINGS: FlowSettings = {
	inboxFilesFolderPath: 'Flow Inbox Files',
	inboxFolderPath: 'Flow Inbox Folder',
	nextActionsFilePath: 'Next Actions.md',
	newProjectTemplateFilePath: 'Templates/Project.md',
	projectsFolderPath: 'Projects',
	newPersonTemplateFilePath: 'Templates/Person.md',
	peopleFolderPath: 'People',
	somedayFilePath: 'Someday.md',
	appendTask: '',

	spheres: ['personal', 'work'],
}

const requiredSettings: (keyof FlowSettings)[] = [
	'inboxFilesFolderPath',
	'inboxFolderPath',
	'nextActionsFilePath',
	'newProjectTemplateFilePath',
	'projectsFolderPath',
	'newPersonTemplateFilePath',
	'peopleFolderPath',
	'somedayFilePath',
]

export function checkMissingSettings(obj: Partial<FlowSettings>): string[] {
	return requiredSettings.filter((key) => !(key in obj))
}
