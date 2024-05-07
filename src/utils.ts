import { TFile } from "obsidian";

export async function openFile(
	filePath: string,
	plugin: ObsidianGTDPlugin,
): Promise<TFile | null> {
	try {
		const file = plugin.app.vault.getAbstractFileByPath(filePath);
		if (file && file instanceof TFile) {
			return file;
		} else {
			console.error(`File not found: ${filePath}`);
			return null;
		}
	} catch (e) {
		console.error(`Failed to read file: ${filePath}`, e);
		return null;
	}
}
