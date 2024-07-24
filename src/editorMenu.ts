import {
	Notice,
	type Editor,
	type Menu,
	type MenuItem,
	type TFile,
} from 'obsidian'

import type FlowPlugin from 'main.js'

import { getOrCreateInboxFile } from 'utils.js'
import { openPlanningView } from 'views/planning.js'

export function createEditorMenu(
	menu: Menu,
	editor: Editor,
	plugin: FlowPlugin,
): void {
	menu.addItem((menuItem: MenuItem) => {
		menuItem.setTitle('Flow')

		const subMenu = menuItem.setSubmenu()

		subMenu.addItem((subMenuItem) => {
			subMenuItem.setTitle('Send this line back to the inbox')
			subMenuItem.onClick(async () => {
				const currentLine = editor.getLine(editor.getCursor().line)

				const inboxFile = await getOrCreateInboxFile(plugin)
				plugin.app.vault.append(inboxFile, currentLine + '\n')

				new Notice('Line has been sent back to the inbox successfully.')
			})
		})

		subMenu.addItem((subMenuItem) => {
			subMenuItem.setTitle('Start processing')
			subMenuItem.onClick(async () => {
				plugin.stateManager.startProcessing()
			})
		})

		subMenu.addItem((subMenuItem) => {
			subMenuItem.setTitle('Start planning')
			subMenuItem.onClick(async () => {
				openPlanningView(plugin)
			})
		})
	})
}
