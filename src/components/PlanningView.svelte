<script lang="ts">
	import { onMount } from 'svelte'
	import type { STask } from 'obsidian-dataview'
	import { Component, WorkspaceLeaf } from 'obsidian'

	import FlowPlugin from '../main'
	import { isPlanningMode, togglePlanningMode } from 'planning'
	import { TaskType, type Task, normaliseTaskText } from '../tasks'
	import { SPHERE_VIEW_TYPE } from '../views/sphere'

	export let plugin: FlowPlugin

	let plannedTasks: Task[] = []

	onMount(() => {
		const unsubscribe = plugin.tasks.plannedTasks.subscribe((value) => {
			plannedTasks = value
			renderTasks()
		})

		return () => unsubscribe()
	})

	function handleTogglePlanningMode() {
		togglePlanningMode(plugin)
	}

	async function renderTasks() {
		const taskContainer = document.querySelector(
			'.flow-planning-task-container',
		)

		if (taskContainer) {
			taskContainer.empty()

			for (const task of plannedTasks) {
				await renderTask(task)
			}

			addCheckboxListeners()
		}
	}

	function createRenderTask() {
		let previousProjectName: string | null = null

		return async function renderTask(task: Task) {
			const taskContainer = document.querySelector(
				'.flow-planning-task-container',
			)
			if (!taskContainer) {
				console.error('Task container not found')
				return
			}

			const taskDiv = document.createElement('div')
			taskDiv.id = `task-${task.id}`
			taskContainer.appendChild(taskDiv)

			let taskList: STask[] = []

			if (task.type == TaskType.PROJECT) {
				taskList = plugin.dv
					.page(task.projectPath)
					.file.tasks.filter(
						(t: STask) => normaliseTaskText(t.text) === task.title,
					)
			} else {
				taskList = plugin.dv
					.page(plugin.settings.nextActionsFilePath)
					.file.tasks.filter(
						(t: STask) => normaliseTaskText(t.text) === task.title,
					)
			}

			try {
				const component = new Component()
				await plugin.dv.taskList(taskList, false, taskDiv, component)
				component.load()
				addRemoveButton(taskDiv)
			} catch (error) {
				console.error('Error rendering task list:', error)
			}

			console.log(task.projectName, previousProjectName)
			if (task.projectName !== previousProjectName) {
				insertProjectName(taskDiv, task)
				previousProjectName = task.projectName
			}
		}
	}

	const renderTask = createRenderTask()

	function insertProjectName(taskDiv: HTMLElement, task: Task) {
		let headerText = 'No project'
		if (task.projectName !== null) {
			headerText = task.projectName
		}
		const projectNameEle = document.createElement('span')
		projectNameEle.classList.add('flow-project-name')
		projectNameEle.innerText = headerText
		taskDiv.prepend(projectNameEle)
	}

	function addCheckboxListeners() {
		const taskContainer = document.querySelector(
			'.flow-planning-task-container',
		)

		if (!taskContainer) {
			console.error('Task container not found')
			return
		}

		const checkboxes = taskContainer.querySelectorAll(
			'.dataview.task-list-item input[type="checkbox"] ',
		)

		checkboxes.forEach((checkbox) => {
			checkbox.addEventListener('click', () => {
				setTimeout(() => {
					renderTasks()
					refreshSphereViews()
				}, 100)
			})
		})
	}

	function addRemoveButton(taskDiv: HTMLDivElement) {
		const liElement = taskDiv.querySelector('li.task-list-item')
		if (!liElement) {
			console.error('Task list item not found')
			return
		}
		const removeButton = document.createElement('button')

		removeButton.innerText = '❌'
		removeButton.classList.add('flow-remove-button')

		removeButton.addEventListener('click', function (event) {
			event.stopPropagation()
			removeTask(taskDiv)
		})

		liElement.appendChild(removeButton)
	}

	function removeTask(taskDiv: HTMLDivElement) {
		const taskId = taskDiv.id.replace('task-', '')
		const task = plannedTasks.find((t) => t.id === taskId)

		if (!task) {
			console.error('Task not found:', taskId)
			return
		}

		plugin.tasks.removeTask(task)
	}

	function refreshSphereViews() {
		plugin.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
			if (leaf.view.getViewType() === SPHERE_VIEW_TYPE) {
				;(leaf.view as any).render()
			}
		})
	}

	async function onClearTasks() {
		if (confirm('Are you sure you want to clear all tasks?')) {
			plugin.tasks.clearTasks()
		}
	}
</script>

<div class="flow-planning-view-container">
	<button on:click={handleTogglePlanningMode}>
		{#if $isPlanningMode}
			Exit Planning Mode
		{/if}
		{#if !$isPlanningMode}
			Enter Planning Mode
		{/if}
	</button>
	<div class="flow-planning-task-container"></div>

	<div class="flow-planning-view-actions">
		<button on:click={onClearTasks}>Clear tasks</button>
	</div>
</div>
