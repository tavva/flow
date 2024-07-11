import type FlowPlugin from 'main'
import { getPlugin } from 'utils'

export async function getMissingDependencies(
	plugin: FlowPlugin,
): Promise<string[][]> {
	const dependencyList = [
		['obsidian-tasks-plugin', 'Tasks'],
		['dataview', 'Dataview'],
		['templater-obsidian', 'Templater'],
	]

	const unmetDependencies = []

	for (const [dependency, dependencyName] of dependencyList) {
		if (!getPlugin(dependency, plugin)) {
			unmetDependencies.push([dependency, dependencyName])
		}
	}

	return unmetDependencies
}

export async function checkDependencies(plugin: FlowPlugin): boolean {
	const unmetDependencies = await getMissingDependencies(plugin)

	return unmetDependencies.length === 0
	if (unmetDependencies.length > 0) {
		return false
	}

	return true
}
