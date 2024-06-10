import { type Writable, writable, get } from 'svelte/store'

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
		const currentTasks = get(this.plannedTasks)

		if (!currentTasks.find((t: Task) => t.id === task.id)) {
			const updatedTasks = [...currentTasks, task]
			await this.plugin.store.delete('plannedTasks')
			await this.plugin.store.store({
				plannedTasks: updatedTasks,
			})
			this.plannedTasks.set(updatedTasks)

			await this.plugin.store.store({
				'last-task-planned': new Date().toDateString(),
			})
		}
	}

	async removeTask(task: Task) {
		const currentTasks = get(this.plannedTasks)
		const updatedTasks = currentTasks.filter((t: Task) => t.id !== task.id)

		await this.plugin.store.delete('plannedTasks')
		await this.plugin.store.store({
			plannedTasks: updatedTasks,
		})

		this.plannedTasks.set(updatedTasks)
	}

	async clearTasks() {
		await this.plugin.store.delete('plannedTasks')
		this.plannedTasks.set([])
	}
}
export function normaliseTaskText(input: string): string {
	const regex =
		/(?:[\p{Emoji_Presentation}\uFE0F\u20E3]\s*)?\d{4}-\d{2}-\d{2}(?:\s*(?:[\p{Emoji_Presentation}\uFE0F\u20E3]\s*)?\d{4}-\d{2}-\d{2})*$/u
	return input.replace(regex, '').trim()
}
