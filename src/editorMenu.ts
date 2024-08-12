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
			subMenuItem.setTitle('Toggle task for planning')
			subMenuItem.onClick(async () => {
				const cursor = editor.getCursor()
				let line = editor.getLine(cursor.line)

				if (!line.startsWith('- [')) {
					new Notice('Only tasks can be planned.')
					return
				}

				if (line.includes('#flow-planned')) {
					line = line.replace(' #flow-planned', '')
				} else {
					line = line + ' #flow-planned'
				}

				editor.setLine(cursor.line, line)

				new Notice('Task has been toggled for planning.')
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
