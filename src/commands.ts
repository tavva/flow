import FlowPlugin from 'main'
import { NewProjectModal } from 'modals/newProjectModal'
import { AddToInboxModal } from 'modals/addToInboxModal'

import { openPlanningView } from 'views/planning'
import {
	createNewProjectFile,
	parseProjectTemplate,
	getOrCreateInboxFile,
} from 'utils'

export async function registerCommands(plugin: FlowPlugin) {
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

	plugin.addCommand({
		id: 'new-project-modal',
		name: 'Create new project',
		callback: async () => {
			new NewProjectModal(
				plugin,
				'',
				async (
					projectName: string,
					description: string,
					spheres: Set<string>,
					priority: number,
				) => {
					const projectFile = await createNewProjectFile(
						plugin,
						projectName,
					)
					let content = await plugin.app.vault.read(projectFile)

					const sphereText = Array.from(spheres)
						.map((s) => `project/${s}`)
						.join(' ')

					content = await parseProjectTemplate({
						content: content,
						priority: priority,
						sphere: sphereText,
						description: description,
					})

					await plugin.app.vault.modify(projectFile, content)

					plugin.metrics.count('new-project-created-from-command')
				},
			).open()
		},
	})

	plugin.addCommand({
		id: 'add-to-inbox',
		name: 'Add to inbox',
		callback: async () => {
			new AddToInboxModal(plugin, async (content: string) => {
				const inboxFile = await getOrCreateInboxFile(plugin)
				plugin.app.vault.append(inboxFile, content + '\n')
			}).open()
		},
	})

	plugin.addRibbonIcon('file-input', 'Add to inbox', () => {
		// @ts-ignore
		plugin.app.commands.executeCommandById('flow:add-to-inbox')
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
