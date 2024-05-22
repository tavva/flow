import { TFile } from 'obsidian'

export async function addToNextActions(plugin: Plugin, text: string) {
	let nextActionsFile = plugin.app.vault.getAbstractFileByPath(
		plugin.settings.nextActionsFilePath,
	) as TFile

	if (!nextActionsFile) {
		nextActionsFile = await plugin.app.vault.create(
			plugin.settings.nextActionsFilePath,
			'',
		)
	}

	const content = await plugin.app.vault.read(nextActionsFile)
	await plugin.app.vault.modify(nextActionsFile, content + '\n' + text)
}

export async function addToProject(
	plugin: Plugin,
	projectFile: TFile,
	text: string,
) {
	const content = await plugin.app.vault.read(projectFile)
	// TODO: Add line to ## Next actions section
	await plugin.app.vault.modify(projectFile, updatedContent)
}

export function readFileContent(file: TFile): Promise<string> {
	return app.vault.read(file)
}

export function writeFileContent(file: TFile, content: string): Promise<void> {
	return app.vault.modify(file, content)
}
