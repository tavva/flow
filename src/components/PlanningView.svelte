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

		if (!taskContainer) {
			console.error('Task container not found')
			return
		}

		taskContainer.empty()

		if (plannedTasks.length === 0) {
			const messageEle = document.createElement('p')
			messageEle.innerText = 'You have no planned actions'
			taskContainer.appendChild(messageEle)
		}

		for (const task of plannedTasks) {
			await renderTask(task)
		}

		addCheckboxListeners()
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

			if (taskList.length > 0) {
				try {
					const component = new Component()
					await plugin.dv.taskList(
						taskList,
						false,
						taskDiv,
						component,
					)
					component.load()
					addRemoveButton(taskDiv)
				} catch (error) {
					console.error('Error rendering task list:', error)
				}
			} else {
				const div = taskDiv.createEl('div')
				const p = div.createEl('p', { cls: 'flow-task-not-found' })
				p.createEl('span', {
					text: 'Task "',
				})
				p.createEl('span', {
					text: task.title,
					cls: 'flow-task-title',
				})
				p.createEl('span', {
					text: `" not found. If you delete, move, or edit a task that
					you've planned, you'll need to re-plan it.`,
				})
			}

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
	<div class="flow-planning-view-sphere-list">
		<span class="flow-planning-view-sphere-header">Spheres:</span>
		{#each plugin.settings.spheres as sphere}
			<div class="flow-planning-view-sphere">
				<button on:click={() => plugin.openSphere(sphere)}
					>{sphere}</button
				>
			</div>
		{/each}
	</div>
	<hr />
	<div class="flow-planning-view-actions">
		<button on:click={handleTogglePlanningMode}>
			{#if $isPlanningMode}
				Exit Planning Mode
			{/if}
			{#if !$isPlanningMode}
				Enter Planning Mode
			{/if}
		</button>
	</div>

	<div class="flow-planning-task-container"></div>

	<div class="flow-planning-view-actions">
		{#if plannedTasks.length > 0}
			<button on:click={onClearTasks}>Clear tasks</button>
		{/if}
	</div>
</div>
