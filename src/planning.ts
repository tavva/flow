import { Writable, writable, get } from 'svelte/store'

import FlowPlugin from './main'

import type { Task } from './tasks'
import { TaskType, normaliseTaskText } from './tasks'
import { openPlanningView } from './views/planning'

export const isPlanningMode: Writable<boolean> = writable(false)

export function togglePlanningMode(plugin: FlowPlugin) {
	isPlanningMode.update((mode) => !mode)
	if (get(isPlanningMode)) {
		openPlanningView(plugin)
	}
}

function generateUniqueId(
	taskType: TaskType,
	projectName: string | null,
	taskText: string,
) {
	if (!projectName) {
		projectName = ''
	}
	return `${taskType}-${projectName}-${taskText.replace(/\s+/g, '-').toLowerCase()}`
}

export function addTaskClickListeners(
	plugin: FlowPlugin,
	container: HTMLElement,
) {
	// We need to set listeners on the checkboxes and the spans rather than on
	// the task container because they were intercepting the click event and
	// not bubbling up

	const handleTaskClick = createHandleTaskClick(plugin)

	const spans = container.querySelectorAll('.dataview.task-list-item span')

	spans.forEach((span) => {
		span.addEventListener('click', handleTaskClick)
	})
}

export function createHandleTaskClick(plugin: FlowPlugin) {
	return async function handleTaskClick(event: any): Promise<void> {
		// TODO fix the function parameter type

		let taskType = TaskType.PROJECT
		let projectName = null
		let projectPath = null

		const taskElement = event.target.closest('.dataview.task-list-item')
		if (!taskElement) return

		const textContent = taskElement.getAttribute('data-task-text')

		try {
			const projectLink = taskElement
				.closest('div')
				.parentElement.closest('li')
				.querySelector('a')
			projectName = projectLink.textContent
			projectPath = projectLink.getAttribute('data-path')
		} catch (error) {
			taskType = TaskType.NON_PROJECT
		}

		const taskText = normaliseTaskText(textContent)
		const uniqueId = generateUniqueId(taskType, projectName, taskText)

		const task: Task = {
			id: uniqueId,
			title: taskText,
			type: taskType,
			projectName: projectName,
			projectPath: projectPath,
		}

		if (get(isPlanningMode)) {
			// These have to be called before the first await
			event.preventDefault()
			event.stopPropagation()

			plugin.tasks.addTask(task)
		} // if we're not in planning mode the event will bubble up
	}
}
