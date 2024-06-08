import { Writable, writable } from 'svelte/store'

import FlowPlugin from './main'

export enum TaskType {
	PROJECT = 'project',
	NON_PROJECT = 'non-project',
}

export interface Task {
	id: string
	title: string
	type: TaskType
	projectName: string | null
	projectPath: string | null
}

export class Tasks {
	plugin: FlowPlugin
	plannedTasks: Writable<Task[]> = writable([])

	constructor(plugin: FlowPlugin) {
		this.plugin = plugin
		this.initializePlannedTasks()
	}

	private async initializePlannedTasks() {
		const initialTasks = await this.plugin.store.retrieve('plannedTasks')
		if (initialTasks) {
			this.plannedTasks.set(initialTasks)
		}
	}

	async addTask(task: Task) {
		this.plannedTasks.update((tasks) => {
			if (!tasks.find((t: Task) => t.id === task.id)) {
				const updatedTasks = [...tasks, task]
				this.plugin.store.store({
					plannedTasks: updatedTasks,
				})
				return updatedTasks
			}
			return tasks
		})
	}

	async clearTasks() {
		this.plannedTasks.set([])
		await this.plugin.store.delete('plannedTasks')
	}
}
export function normaliseTaskText(input: string): string {
	const regex =
		/(?:[\p{Emoji_Presentation}\uFE0F\u20E3]\s*)?\d{4}-\d{2}-\d{2}(?:\s*(?:[\p{Emoji_Presentation}\uFE0F\u20E3]\s*)?\d{4}-\d{2}-\d{2})*$/u
	return input.replace(regex, '').trim()
}
