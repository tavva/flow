import { Notice } from 'obsidian'
import { STask } from 'obsidian-dataview'
import { get } from 'svelte/store'

import FlowPlugin from 'main'
import { type Task } from 'tasks'
import { getPlugin } from 'utils'

export class TaskCache {
	plugin: FlowPlugin
	tasks: Task[] = []

	constructor(plugin: FlowPlugin) {
		this.plugin = plugin
		this.cachePlannedTasks()

		this.plugin.registerEvent(
			getPlugin(
				'obsidian-tasks-plugin',
				plugin,
			).cache.events.onCacheUpdate(this.checkCache.bind(this)),
		)
	}

	private async checkCache() {
		const newCache = await this.getPlannedTasks()
		if (newCache.length < this.tasks.length) {
			new Notice(
				'A planned task has been edited or removed. Note that it will no longer show up in your Planned Tasks list.',
			)
			this.tasks = newCache
		}
	}

	private getCachedTasks() {
		const cachedTasks = getPlugin('obsidian-tasks-plugin', this.plugin)
			.cache.tasks
		return cachedTasks
	}

	private async getPlannedTasks() {
		const plannedTasks = get(this.plugin.tasks.plannedTasks)
		const cachedTasks = this.getCachedTasks()

		return plannedTasks.filter((plannedTask: Task) =>
			cachedTasks.some(
				(task: STask) =>
					plannedTask.projectPath == task.taskLocation.path &&
					plannedTask.title == task.description,
			),
		)
	}

	private async cachePlannedTasks() {
		this.tasks = await this.getPlannedTasks()
	}
}
