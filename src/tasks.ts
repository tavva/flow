import { TFile, debounce } from 'obsidian'
import { STask } from 'obsidian-dataview'

import FlowPlugin from 'main.js'

export class Tasks {
	plugin: FlowPlugin
	exportPlannedTasksDebounced: () => void

	constructor(plugin: FlowPlugin) {
		this.plugin = plugin
		this.exportPlannedTasksDebounced = debounce(
			this.exportPlannedTasks.bind(this),
			5000,
			true,
		)
		this.plugin.events.on('planned-tasks-updated', () => {
			this.exportPlannedTasksDebounced()
		})
	}

	getTask(description: string, path: string) {
		return this.plugin.dv
			.pages()
			.file.tasks.where(
				(t: STask) => t.text == description && t.path == path,
			)[0]
	}

	getPlannedTasks() {
		return this.plugin.dv
			.pages('#flow-planned')
			.file.tasks.where((t: STask) => t.text.includes('#flow-planned'))
	}

	protected async replaceLineInFile(
		path: string,
		lineNumber: number,
		newLine: string,
	): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(path)
		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${path}`)
		}

		await this.plugin.app.vault.process(file, (fileContent) => {
			const lines = fileContent.split('\n')

			if (lineNumber < 1 || lineNumber > lines.length) {
				throw new Error(`Line number ${lineNumber} is out of range`)
			}

			lines[lineNumber] = newLine
			const newContent = lines.join('\n')
			return newContent
		})
	}

	async markTaskAsPlannedNextAction(task: STask) {
		if (task.tags.includes('#flow-planned')) {
			return
		}
		const text = task.text.trimEnd() + ' #flow-planned'
		const line = task.symbol + ' [' + task.status + '] ' + text

		await this.replaceLineInFile(task.path, task.line, line)

		setTimeout(() => {
			this.plugin.events.trigger('planned-tasks-updated')
		}, 1000)
	}

	async unmarkTaskAsPlannedNextAction(task: STask) {
		const text = task.text.replace(/\s*#flow-planned/, '')
		const line = task.symbol + ' [' + task.status + '] ' + text

		await this.replaceLineInFile(task.path, task.line, line)

		setTimeout(() => {
			this.plugin.events.trigger('planned-tasks-updated')
		}, 1000)
	}

	async unmarkAllTasksAsPlannedNextAction() {
		const tasks = this.getPlannedTasks()
		for (const task of tasks) {
			await this.unmarkTaskAsPlannedNextAction(task)
		}
	}

	async unmarkAllDoneTasksAsPlannedNextAction() {
		const tasks = this.getPlannedTasks()
		for (const task of tasks) {
			if (task.completed) {
				await this.unmarkTaskAsPlannedNextAction(task)
			}
		}
	}

	deleteOldTasks() {
		const tasks = this.getPlannedTasks()
		if (tasks.length === 0) {
			// Return early so we don't update the store (and therefore refresh
			// the planning view)
			return
		}
		const tasksToStore = []

		for (const task of tasks) {
			tasksToStore.push(task)
		}

		this.unmarkAllTasksAsPlannedNextAction()
		this.plugin.store.store({ 'old-tasks': tasksToStore })
	}

	async getOldTasks() {
		return (await this.plugin.store?.retrieve('old-tasks')) ?? []
	}

	private async exportPlannedTasks() {
		if (!this.plugin.settings.exportPlannedTasks) {
			return
		}

		const tasks = this.getPlannedTasks()
		const content = tasks
			.map((t: STask) => t.text)
			.join('\n')
			.trim()

		const file = this.plugin.app.vault.getAbstractFileByPath(
			'flow-planned-export.md',
		)
		if (!(file instanceof TFile)) {
			this.plugin.app.vault.create('flow-planned-export.md', content)
			return
		}

		await this.plugin.app.vault.modify(file, content)
	}
}
