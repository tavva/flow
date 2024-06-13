import FlowPlugin from 'main'

import { openPlanningView } from './views/planning'

export async function registerCommands(plugin: FlowPlugin) {
	plugin.addCommand({
		id: 'process-inboxes',
		name: 'Process Inboxes',
		callback: () => plugin.stateManager.startProcessing(),
	})
	plugin.addCommand({
		id: 'process-inboxes',
		name: 'Process Inboxes',
		callback: () => plugin.stateManager.startProcessing(),
	})

	plugin.addCommand({
		id: 'view-personal-sphere',
		name: 'View Personal Sphere',
		callback: await plugin.openSphere('personal'),
	})

	plugin.addCommand({
		id: 'view-work-sphere',
		name: 'View Work Sphere',
		callback: await plugin.openSphere('work'),
	})

	plugin.addCommand({
		id: 'show-planned-actions',
		name: 'Show planned actions',
		callback: async () => {
			openPlanningView(plugin)
		},
	})
}
