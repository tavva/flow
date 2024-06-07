import { Writable, writable } from 'svelte/store'

import FlowPlugin from './main'

export interface Task {
	id: string
	title: string
	project: string
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
		console.log('retrieved tasks', initialTasks)
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
