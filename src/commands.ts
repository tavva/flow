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

	plugin.addCommand({
		id: 'show-planned-actions',
		name: 'Show planned actions',
		callback: async () => {
			openPlanningView(plugin)
		},
	})

	resetSphereCommands(plugin)
}

export async function resetSphereCommands(plugin: FlowPlugin) {
	const commands: { [key: string]: any } = Object.keys(
		// @ts-ignore
		plugin.app.commands['commands'],
	)

	const sphereCommands: string[] = commands.filter(
		(c: string) => c.startsWith('flow:view-') && c.endsWith('-sphere'),
	)
	for (const command of sphereCommands) {
		delete commands[command]
	}

	for (let sphere of plugin.settings.spheres) {
		sphere = sphere.toLowerCase()

		plugin.addCommand({
			id: `view-${sphere}-sphere`,
			name: `View ${sphere} sphere`,
			callback: () => plugin.openSphere(sphere),
		})
	}
}
