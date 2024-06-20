import type FlowPlugin from 'main'
import type { Editor, Menu, MenuItem, TFile } from 'obsidian'

async function getOrCreateInboxFile(plugin: FlowPlugin): Promise<TFile> {
	const inboxPath = plugin.settings.inboxFilesFolderPath
	const inboxFileFolder = plugin.app.vault.getAbstractFileByPath(inboxPath)
	if (!inboxFileFolder) {
		throw new Error('Inbox folder not found')
	}

	const inboxFilePath = inboxFileFolder.path + '/Flow generated inbox.md'
	let inboxFile = plugin.app.vault.getAbstractFileByPath(inboxFilePath)

	if (!inboxFile) {
		await plugin.app.vault.create(inboxFilePath, '')
	}

	inboxFile = plugin.app.vault.getAbstractFileByPath(inboxFilePath)

	return inboxFile as TFile
}

export function createEditorMenu(
	menu: Menu,
	editor: Editor,
	plugin: FlowPlugin,
): void {
	menu.addItem((menuItem: MenuItem) => {
		menuItem.setTitle('Flow')

		const subMenu = menuItem.setSubmenu()

		subMenu.addItem((subMenuItem) => {
			subMenuItem.setTitle('Send back to inbox')
			subMenuItem.onClick(async () => {
				const currentLine = editor.getLine(editor.getCursor().line)

				const inboxFile = await getOrCreateInboxFile(plugin)
				plugin.app.vault.append(inboxFile, currentLine + '\n')
			})
		})
	})
}
