import { TFile } from 'obsidian'

export async function addToNextActions(app: App, text: string) {
	const nextActionsPath = 'NextActions.md' // TODO: use settings
	let nextActionsFile = app.vault.getAbstractFileByPath(
		nextActionsPath,
	) as TFile

	if (!nextActionsFile) {
		nextActionsFile = await app.vault.create(nextActionsPath, '')
	}

	const content = await app.vault.read(nextActionsFile)
	await app.vault.modify(nextActionsFile, content + '\n' + text)
}

export async function addToProject(app: App, projectFile: TFile, text: string) {
	const content = await app.vault.read(projectFile)
	// TODO: Add line to ## Next actions section
	await app.vault.modify(projectFile, updatedContent)
}

export function readFileContent(file: TFile): Promise<string> {
	return app.vault.read(file)
}

export function writeFileContent(file: TFile, content: string): Promise<void> {
	return app.vault.modify(file, content)
}
