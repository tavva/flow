<script lang="ts">
	import type { STask } from 'obsidian-dataview'
	import { Component, WorkspaceLeaf } from 'obsidian'
	import { onMount } from 'svelte'

	import FlowPlugin from 'main'
	import { isPlanningMode, togglePlanningMode } from 'planning'
	import { SPHERE_VIEW_TYPE } from 'views/sphere'

	export let plugin: FlowPlugin
	export let plannedTasks: STask[] = []

	onMount(() => {
		renderTasks(plannedTasks)
	})

	$: renderTasks(plannedTasks)

	function renderTasks(tasks: STask[]) {
		const container = document.querySelector(
			'.flow-planning-task-container',
		)

		if (!container) {
			console.error('Container not found')
			return
		}

		container.empty()

		try {
			const component = new Component()
			plugin.dv.taskList(tasks, true, container, component)
			component.load()
		} catch (error) {
			console.error('Error rendering task list:', error)
		}

		container.querySelectorAll('.task-list-item').forEach((li) => {
			addRemoveButton(li as HTMLLIElement)
		})
	}

	function handleTogglePlanningMode() {
		togglePlanningMode(plugin)
	}

	function addRemoveButton(li: HTMLLIElement) {
		const parent = li.parentElement
		if (!parent) {
			console.error('Parent not found')
			return
		}

		var taskDiv = document.createElement('div')
		taskDiv.addClass('flow-planning-task')

		parent.replaceChild(taskDiv, li)
		taskDiv.appendChild(li)

		const removeButton = document.createElement('button')

		removeButton.innerText = '❌'
		removeButton.classList.add('flow-remove-button')

		removeButton.addEventListener('click', function (event) {
			event.stopPropagation()
			removeTask(taskDiv)
		})

		taskDiv.appendChild(removeButton)
	}

	function removeTask(taskDiv: HTMLDivElement) {
		const taskListItem = taskDiv.querySelector(
			'.dataview.task-list-item',
		) as HTMLLIElement

		const taskItem = taskDiv.querySelector('.dataview.task-list-item')
		if (!taskItem) {
			console.error('Task item not found')
			return
		}

		const clonedTaskItem = taskItem.cloneNode(true) as HTMLElement
		clonedTaskItem.querySelectorAll('ul').forEach((ul) => ul.remove())
		const taskName = clonedTaskItem.textContent?.trim() || ''

		let path = ''
		const resultGroup = taskDiv.closest('.dataview.result-group')
		if (resultGroup) {
			const titleElement = resultGroup.previousElementSibling
			if (titleElement) {
				const linkElement =
					titleElement.querySelector('a.internal-link')
				if (linkElement) {
					path = linkElement.getAttribute('data-href') || ''
				}
			}
		}

		if (!path) {
			console.error('Parent filepath not found')
			return
		}

		const task = plugin.tasks.getTask(taskName, path)
		if (!task) {
			console.error('Task not found')
			return
		}

		plugin.tasks.unmarkTaskAsPlannedNextAction(task)
		const index = plannedTasks.indexOf(task)
		console.log('index', index)
		if (index > -1) {
			plannedTasks.splice(index, 1)
		}
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
			plugin.tasks.unmarkAllTasksAsPlannedNextAction()
		}
	}
	async function onClearCompletedTasks() {
		if (confirm('Are you sure you want to clear completed tasks?')) {
			plugin.tasks.unmarkAllCompletedTasksAsPlannedNextAction()
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
				Exit planning mode
			{/if}
			{#if !$isPlanningMode}
				Enter planning mode
			{/if}
		</button>
	</div>

	<div class="flow-planning-task-container"></div>

	<div class="flow-planning-view-actions">
		{#if plannedTasks.length > 0}
			<button on:click={onClearTasks}>Clear all planned actions</button>
			<button on:click={onClearCompletedTasks}
				>Clear completed actions</button
			>
		{/if}
	</div>
</div>
