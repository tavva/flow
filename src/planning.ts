import { Writable, writable, get } from 'svelte/store'

import FlowPlugin from './main'

import type { Task } from './tasks'

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

	const spans = container.querySelectorAll('.dataview.task-list-item span')

	spans.forEach((span) => {
		span.addEventListener('click', handleTaskClick)
	})
}

export function createHandleTaskClick(plugin: FlowPlugin) {
	return async function handleTaskClick(event: any): Promise<void> {
		// TODO fix the type
		const taskElement = event.target.closest('.dataview.task-list-item')
		if (!taskElement) return

		const taskTitleElement = taskElement.querySelector('span')
		if (!taskTitleElement) return

		const taskListContainer = taskElement.closest('div[id^="task-list-"]')
		if (!taskListContainer) return

		const projectLink = taskElement.closest('div').parentElement.closest('li').querySelector('a')
		const projectName = projectLink.textContent;
		const projectPath = projectLink.getAttribute('data-path');

		const taskText = taskTitleElement.textContent.trim()
		const uniqueId = generateUniqueId(projectName, taskText)

		const task: Task = {
			id: uniqueId,
			title: taskText,
			projectName: projectName,
			projectPath: projectPath
		}

		if (get(isPlanningMode)) {
			// These have to be called before the first await
			event.preventDefault()
			event.stopPropagation()

			plugin.tasks.addTask(task)
		} // if we're not in planning mode the event will bubble up
	}
}
