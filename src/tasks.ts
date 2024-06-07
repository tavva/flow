import { Writable, writable, get } from 'svelte/store'

import FlowPlugin from './main'
import { store, retrieve } from './store'

export interface Task {
	id: string
	title: string
	project: string
}

export const plannedTasks: Writable<Task[]> = writable([])

export async function addTask(plugin: FlowPlugin, task: Task) {
	const tasks = await retrieve(plugin, 'plannedTasks')
	if (!tasks.find((t: Task) => t.id === task.id)) {
		plannedTasks.update((tasks) => [...tasks, task])
		await store(plugin, { plannedTasks: get(plannedTasks) })
	}
	plannedTasks.update((tasks) => [...tasks, task])
}

export async function initializePlannedTasks(plugin: FlowPlugin) {
	const initialTasks = await retrieve(plugin, 'plannedTasks')
	if (initialTasks) {
		plannedTasks.set(initialTasks)
	}
}
