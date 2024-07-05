import { TFile } from 'obsidian'
import { STask } from 'obsidian-dataview'

import FlowPlugin from 'main'

export class Tasks {
	plugin: FlowPlugin

	constructor(plugin: FlowPlugin) {
		this.plugin = plugin
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

		const fileContent = await this.plugin.app.vault.read(file)
		const lines = fileContent.split('\n')

		if (lineNumber < 1 || lineNumber > lines.length) {
			throw new Error(`Line number ${lineNumber} is out of range`)
		}

		lines[lineNumber] = newLine
		const newContent = lines.join('\n')

		await this.plugin.app.vault.modify(file, newContent)
	}

	async markTaskAsPlannedNextAction(task: STask) {
		if (task.tags.includes('#flow-planned')) {
			return
		}
		const text = task.text.trim() + ' #flow-planned'
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

	async unmarkAllCompletedTasksAsPlannedNextAction() {
		const tasks = this.getPlannedTasks()
		for (const task of tasks) {
			if (task.completed) {
				await this.unmarkTaskAsPlannedNextAction(task)
			}
		}
	}
}
