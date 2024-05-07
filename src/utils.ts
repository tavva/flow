import { App, TFile } from "obsidian";

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

export function getFilesWithTagPrefix(app: App, prefix: string): TFile[] {
	const { metadataCache, vault } = app;
	const files = vault.getFiles();

	return files.filter((file) => {
		const cache = metadataCache.getFileCache(file);
		if (!cache || !cache.frontmatter) {
			return false;
		}

		let tags: string[] = [];
		if (Array.isArray(cache.frontmatter.tags)) {
			tags = cache.frontmatter.tags;
		} else if (typeof cache.frontmatter.tags === "string") {
			tags = cache.frontmatter.tags.split(/\s+/);
		}

		return tags.some((tag) => tag.startsWith(prefix));
	});
}

export async function countLinesInFile(
	plugin: ObsidianGTDPlugin,
	file: TFile,
): Promise<number> {
	const fileContent = await plugin.app.vault.read(file);
	return fileContent.split(/\r?\n/).length;
}
