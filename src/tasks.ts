import { TFile, debounce } from 'obsidian'
import { STask } from 'obsidian-dataview'

import FlowPlugin from './main.js'

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

        // Run here to refresh the export with data synced from another device
        this.exportPlannedTasksDebounced()
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

    async deleteOldTasks() {
        if (!this.plugin.settings.automaticallyDeleteOldTasks) {
            return
        }

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const epoch = new Date(Date.now() - 6 * 60 * 60 * 1000)
        const lastTaskPlanned =
            await this.plugin.store.retrieve('last-task-planned')
        if (
            lastTaskPlanned === undefined ||
            lastTaskPlanned >= today.getTime() ||
            lastTaskPlanned >= epoch.getTime()
        ) {
            return
        }

        const tasks = this.getPlannedTasks().where((t: STask) => !t.completed)
        if (tasks.length === 0) {
            // Return early so we don't update the store (and therefore refresh
            // the planning view)
            return
        }
        const tasksToStore = []

        for (const task of tasks) {
            await this.unmarkTaskAsPlannedNextAction(task)
            tasksToStore.push(task)
        }

        this.plugin.store.store({ 'old-tasks': tasksToStore })
    }

    async deleteSavedOldTasks() {
        this.plugin.store.delete('old-tasks')
    }

    async getOldTasks() {
        return (await this.plugin.store?.retrieve('old-tasks')) ?? []
    }

    private async exportPlannedTasks() {
        if (!this.plugin.settings.exportPlannedTasks) {
            return
        }

        const filename = 'flow-planned-actions-export.md'

        const tasks = this.getPlannedTasks()
        const output = JSON.stringify([
            ...tasks.map((t: STask) => t.text.replace(/#[^\s]+/g, '').trim()),
        ])

        const file = this.plugin.app.vault.getAbstractFileByPath(filename)
        if (!(file instanceof TFile)) {
            this.plugin.app.vault.create(filename, output)
            return
        }

        await this.plugin.app.vault.modify(file, output)
    }
}
