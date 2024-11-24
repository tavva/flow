import { type Writable, writable, get } from 'svelte/store'

import FlowPlugin from './main.js'

import { openPlanningView } from './views/planning.js'

export const isPlanningMode: Writable<boolean> = writable(false)

export function togglePlanningMode(plugin: FlowPlugin) {
	isPlanningMode.update((mode) => !mode)
	if (get(isPlanningMode)) {
		openPlanningView(plugin)
	}
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

		const taskElement = event.target.closest('.dataview.task-list-item')
		if (!taskElement) return

		const textContent = taskElement.getAttribute('data-task-text')

		let path = null

		try {
			const projectLink = taskElement
				.closest('div')
				.parentElement.closest('li')
				.querySelector('a')
			path = projectLink.getAttribute('data-path')
		} catch (error) {
			path = plugin.settings.nextActionsFilePath
		}

		const task = plugin.tasks.getTask(textContent, path)

		if (get(isPlanningMode)) {
			// These have to be called before the first await
			event.preventDefault()
			event.stopPropagation()

			plugin.tasks.markTaskAsPlannedNextAction(task)
		} // if we're not in planning mode the event will bubble up
	}
}
