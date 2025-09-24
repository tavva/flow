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
        originalLine?: string,
    ): Promise<void> {
        const file = this.plugin.app.vault.getAbstractFileByPath(path)
        if (!(file instanceof TFile)) {
            throw new Error(`File not found: ${path}`)
        }

        await this.plugin.app.vault.process(file, (fileContent) => {
            const lines = fileContent.split('\n')

            const resolvedIndex = this.resolveLineIndex(
                lines,
                lineNumber,
                originalLine,
            )

            lines[resolvedIndex] = newLine
            const newContent = lines.join('\n')
            return newContent
        })
    }

    async markTaskAsPlannedNextAction(task: STask) {
        if (task.tags.includes('#flow-planned')) {
            return
        }
        const originalLine = this.buildTaskLine(task, task.text)
        const text = this.addPlannedTag(task.text)
        const line = this.buildTaskLine(task, text)

        await this.replaceLineInFile(task.path, task.line, line, originalLine)

        setTimeout(() => {
            this.plugin.events.trigger('planned-tasks-updated')
        }, 1000)
    }

    async unmarkTaskAsPlannedNextAction(task: STask) {
        const originalLine = this.buildTaskLine(task, task.text)
        const text = this.removePlannedTag(task.text)
        const line = this.buildTaskLine(task, text)

        await this.replaceLineInFile(task.path, task.line, line, originalLine)

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

    private buildTaskLine(task: STask, text: string): string {
        return `${task.symbol} [${task.status}] ${text}`
    }

    private addPlannedTag(text: string): string {
        const withoutTrailingWhitespace = text.replace(/\s+$/, '')
        const separator = withoutTrailingWhitespace.length === 0 ? '' : ' '
        return `${withoutTrailingWhitespace}${separator}#flow-planned`
    }

    private removePlannedTag(text: string): string {
        const withoutTag = text.replace(/\s*#flow-planned\b/, '')
        return withoutTag.replace(/\s+$/, '')
    }

    private resolveLineIndex(
        lines: string[],
        lineNumber: number,
        originalLine?: string,
    ): number {
        if (lines.length === 0) {
            throw new Error('Cannot update empty file')
        }

        const matchesOriginal = (line: string) => {
            if (originalLine === undefined) {
                return true
            }

            if (line === originalLine) {
                return true
            }

            return line.trimEnd() === originalLine.trimEnd()
        }

        const clamp = (idx: number) => {
            if (idx < 0) {
                return 0
            }
            if (idx >= lines.length) {
                return lines.length - 1
            }
            return idx
        }

        const candidates: number[] = []
        const addCandidate = (idx: number) => {
            if (idx < 0 || idx >= lines.length) {
                return
            }
            if (!candidates.includes(idx)) {
                candidates.push(idx)
            }
        }

        const zeroBasedGuess =
            lineNumber > 0 ? clamp(lineNumber - 1) : clamp(lineNumber)

        addCandidate(clamp(lineNumber))
        addCandidate(zeroBasedGuess)
        addCandidate(clamp(zeroBasedGuess - 1))
        addCandidate(clamp(zeroBasedGuess + 1))

        if (originalLine !== undefined) {
            const trimmedOriginal = originalLine.trimEnd()
            lines.forEach((line, index) => {
                if (line.trimEnd() === trimmedOriginal) {
                    addCandidate(index)
                }
            })
        }

        for (const idx of candidates) {
            if (matchesOriginal(lines[idx])) {
                return idx
            }
        }

        if (candidates.length > 0) {
            return candidates[0]
        }

        throw new Error(
            `Line number ${lineNumber} is out of range for file with ${lines.length} lines`,
        )
    }
}
