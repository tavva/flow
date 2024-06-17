import { Notice } from 'obsidian'
import { STask } from 'obsidian-dataview'
import { get } from 'svelte/store'

import FlowPlugin from './main'
import { type Task } from './tasks'

export class TaskCache {
	plugin: FlowPlugin
	tasks: Task[] = []

	constructor(plugin: FlowPlugin) {
		this.plugin = plugin
		this.cacheTasks()

		this.plugin.registerEvent(
			// @ts-ignore
			this.plugin.app.plugins.plugins[
				'obsidian-tasks-plugin'
			].cache.events.onCacheUpdate(this.checkCache.bind(this)),
		)
	}

	private async checkCache() {
		const newCache = await this.getTasks()
		if (newCache.length < this.tasks.length) {
			new Notice(
				'A planned task has been edited or removed. Note that it will no longer show up in your Planned Tasks list.',
			)
			this.tasks = newCache
		}
	}

	private async getTasks() {
		const plannedTasks = get(this.plugin.tasks.plannedTasks)
		const cachedTasks =
			// @ts-ignore
			this.plugin.app.plugins.plugins['obsidian-tasks-plugin'].cache.tasks

		return plannedTasks.filter((plannedTask: Task) =>
			cachedTasks.some(
				(task: STask) =>
					plannedTask.projectPath == task.taskLocation.path &&
					plannedTask.title == task.description,
			),
		)
	}

	private async cacheTasks() {
		this.tasks = await this.getTasks()
	}
}
