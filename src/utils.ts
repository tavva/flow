import { TFile } from 'obsidian'

export function readFileContent(file: TFile): Promise<string> {
	return app.vault.read(file)
}

export function writeFileContent(file: TFile, content: string): Promise<void> {
	return app.vault.modify(file, content)
}
