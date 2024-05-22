import { Plugin } from 'obsidian'
import { StateManager } from './state'

export function registerCommands(plugin: Plugin, stateManager: StateManager) {
	plugin.addCommand({
		id: 'process-inboxes',
		name: 'Process Inboxes',
		callback: () => stateManager.startProcessing(),
	})
}
