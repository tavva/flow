import { writable } from 'svelte/store'

export const planningTasks = writable([])
export const isPlanningMode = writable(false)

export function togglePlanningMode() {
	isPlanningMode.update((mode) => !mode)
}

function generateUniqueId(projectName, taskText) {
	return `${projectName}-${taskText.replace(/\s+/g, '-').toLowerCase()}`
}

export function handleTaskClick(event) {
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

	if (isPlanningMode) {
		planningTasks.update((tasks) => [...tasks, task])
		event.preventDefault()
	} // else the event will bubble up
}
