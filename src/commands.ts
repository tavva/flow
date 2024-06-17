import FlowPlugin from 'main'

import { openPlanningView } from './views/planning'

export async function registerCommands(plugin: FlowPlugin) {
	// FIXME: Be consistent in how we extract these, we have registerViews and
	// registerCommands where one is a method on the plugin and the other is a
	// function in its own file

	plugin.addCommand({
		id: 'process-inboxes',
		name: 'Process Inboxes',
		callback: () => plugin.stateManager.startProcessing(),
	})

	// TODO: Don't hardcode spheres
	plugin.addCommand({
		id: 'view-personal-sphere',
		name: 'View Personal Sphere',
		callback: () => plugin.openSphere('personal'),
	})

	plugin.addCommand({
		id: 'view-work-sphere',
		name: 'View Work Sphere',
		callback: () => plugin.openSphere('work'),
	})

	plugin.addCommand({
		id: 'show-planned-actions',
		name: 'Show planned actions',
		callback: async () => {
			openPlanningView(plugin)
		},
	})
}
