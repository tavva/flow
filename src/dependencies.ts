import { Notice } from 'obsidian'

import type FlowPlugin from 'main'
import { getPlugin } from 'utils'

export function checkDependencies(plugin: FlowPlugin): boolean {
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

	if (unmetDependencies.length > 0) {
		const dependencyList = unmetDependencies.map((d) => d[0]).join(', ')
		const dependencyNameList = unmetDependencies.map((d) => d[1]).join(', ')
		new Notice(
			`Flow requires the following plugins to be installed and enabled: ${dependencyNameList} (${dependencyList}).`,
		)
		return false
	}

	return true
}
