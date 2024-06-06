import { STask } from 'obsidian-dataview'
import { Writable, writable, get } from 'svelte/store'

import FlowPlugin from '../main'
import { store } from '../store'

export const plannedTasks: Writable<STask[]> = writable([])
export const isPlanningMode: Writable<boolean> = writable(false)

export function togglePlanningMode() {
	isPlanningMode.update((mode) => !mode)
}

function generateUniqueId(projectName: string, taskText: string) {
	return `${projectName}-${taskText.replace(/\s+/g, '-').toLowerCase()}`
}

export function addTaskClickListeners(
	plugin: FlowPlugin,
	container: HTMLElement,
) {
	// We need to set listeners on the checkboxes and the spans rather than on
	// the task container because they were intercepting the click event and
	// not bubbling up

	const handleTaskClick = createHandleTaskClick(plugin)

	const checkboxes = container.querySelectorAll(
		'.dataview.task-list-item-checkbox',
	)
	const spans = container.querySelectorAll('.dataview.task-list-item span')

	checkboxes.forEach((checkbox) => {
		checkbox.addEventListener('click', handleTaskClick)
	})

	spans.forEach((span) => {
		span.addEventListener('click', handleTaskClick)
	})
}

export function createHandleTaskClick(plugin: FlowPlugin) {
	return function handleTaskClick(event: any) {
		// TODO fix the type
		const taskElement = event.target.closest('.dataview.task-list-item')
		if (!taskElement) return

		const taskTitleElement = taskElement.querySelector('span')
		if (!taskTitleElement) return

		const taskListContainer = taskElement.closest('div[id^="task-list-"]')
		if (!taskListContainer) return

		const projectName = taskListContainer.id.replace('task-list-', '')
		const taskText = taskTitleElement.textContent.trim()
		const uniqueId = generateUniqueId(projectName, taskText)

		const task = {
			id: uniqueId,
			title: taskText,
			project: projectName,
		}

		if (get(isPlanningMode)) {
			plannedTasks.update((tasks) => [...tasks, task])
			store(plugin, { plannedTasks: get(plannedTasks) })
			event.preventDefault()
			event.stopPropagation()
		} // else the event will bubble up
	}
}
