import { Plugin } from 'obsidian'
import { InboxProcessor } from './inboxProcessor'

export function registerCommands(
	plugin: Plugin,
	inboxProcessor: InboxProcessor,
) {
	plugin.addCommand({
		id: 'process-inboxes',
		name: 'Process Inboxes',
		callback: () => inboxProcessor.startProcessing(),
	})
}
