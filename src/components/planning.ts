import { STask } from 'obsidian-dataview'
import { Writable, writable, get } from 'svelte/store'

export const planningTasks: Writable<STask[]> = writable([])
export const isPlanningMode: Writable<boolean> = writable(false)

export function togglePlanningMode() {
	isPlanningMode.update((mode) => !mode)
	console.log(isPlanningMode)
}

function generateUniqueId(projectName: string, taskText: string) {
	return `${projectName}-${taskText.replace(/\s+/g, '-').toLowerCase()}`
}

export function addTaskClickListeners(container: HTMLElement) {
	// We need to set listeners on the checkboxes and the spans rather than on
	// the task container because they were intercepting the click event and
	// not bubbling up
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

export function handleTaskClick(event: any) {
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
		planningTasks.update((tasks) => [...tasks, task])
		event.preventDefault()
		event.stopPropagation()
	} // else the event will bubble up
}
