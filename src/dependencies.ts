import type FlowPlugin from './main.js'
import { getPlugin } from './utils.js'

export function getMissingDependencies(plugin: FlowPlugin): string[][] {
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

export function checkDependencies(plugin: FlowPlugin): boolean {
    const unmetDependencies = getMissingDependencies(plugin)
    return unmetDependencies.length === 0
}
