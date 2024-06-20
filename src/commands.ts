import FlowPlugin from 'main'

import { openPlanningView } from 'views/planning'

export async function registerCommands(plugin: FlowPlugin) {
	// FIXME: Be consistent in how we extract these, we have registerViews and
	// registerCommands where one is a method on the plugin and the other is a
	// function in its own file

	plugin.addCommand({
		id: 'start-processing',
		name: 'Start processing',
		callback: () => plugin.stateManager.startProcessing(),
	})

	plugin.addCommand({
		id: 'open-planning-view',
		name: 'Open planning view',
		callback: async () => {
			openPlanningView(plugin)
		},
	})

	resetSphereCommands(plugin)
}

function getSphereCommands(plugin: FlowPlugin): string[] {
	const commands: { [key: string]: any } = Object.keys(
		// @ts-ignore
		plugin.app.commands['commands'],
	)

	return commands.filter(
		(c: string) => c.startsWith('flow:view-') && c.endsWith('-sphere'),
	)
}

export async function resetSphereCommands(plugin: FlowPlugin) {
	const sphereCommands = getSphereCommands(plugin)

	for (const command of sphereCommands) {
		// @ts-ignore
		delete plugin.app.commands['commands'][command]
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
