<script lang="ts">
	import _ from 'lodash'

	import type { STask } from 'obsidian-dataview'
	import { Component } from 'obsidian'
	import { onMount } from 'svelte'

	import store from 'svelteStore.js'
	import FlowPlugin from 'main.js'
	import { isPlanningMode, togglePlanningMode } from 'planning.js'

	let plugin: FlowPlugin
	store.plugin.subscribe((p: FlowPlugin) => (plugin = p))

	export let plannedTasks: STask[] = []
	export let oldPlannedTasks: STask[]
	let showOldTasks = false

	onMount(() => {
		renderTasks(plannedTasks)

		setInterval(() => {
			const latestPlannedTasks = plugin.tasks.getPlannedTasks()
			if (!_.isEqual(plannedTasks.values, latestPlannedTasks.values)) {
				plannedTasks = latestPlannedTasks
			}
		}, 1000)
	})

	$: renderTasks(plannedTasks)

	function openTaskNote(event: MouseEvent) {
		event.preventDefault()
		const target = event.target as HTMLElement
		const path = target.getAttribute('data-path')
		if (path) {
			plugin.app.workspace.openLinkText(path, '')
		}
	}
	function renderTasks(tasks: STask[]) {
		const container = document.querySelector(
			'.flow-planning-task-container',
		)

		if (!container) {
			console.error('Container not found')
			return
		}

		container.empty()

		if (tasks.length === 0) {
			const noActionsDiv = container.createEl('div', {
				cls: 'flow-planning-no-actions',
			})

			noActionsDiv.createEl('h3', {
				text: 'No actions planned yet',
			})
			noActionsDiv.createEl('p', {
				text: 'Enter planning mode and open your spheres to plan your next actions',
			})
			return
		}

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
		const taskItem = taskDiv.querySelector(
			'.dataview.task-list-item',
		) as HTMLLIElement

		if (!taskItem) {
			console.error('Task item not found')
			return
		}

		const clonedTaskItem = taskItem.cloneNode(true) as HTMLElement

		// We do this as Tasks renders the emoji as an <img> tag, but we need
		// it to match the task text
		clonedTaskItem.querySelectorAll('img').forEach((img) => {
			const altText = img.alt
			const textNode = document.createTextNode(altText)
			img.replaceWith(textNode)
		})

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

		if (task) {
			plugin.tasks.unmarkTaskAsPlannedNextAction(task)
		} else {
			console.error('Task not found')
		}

		plannedTasks = plugin.tasks.getPlannedTasks()
	}

	async function onClearTasks() {
		if (confirm('Are you sure you want to clear all tasks?')) {
			plugin.tasks.unmarkAllTasksAsPlannedNextAction()
		}
	}
	async function onClearDoneTasks() {
		if (confirm('Are you sure you want to clear done tasks?')) {
			plugin.tasks.unmarkAllDoneTasksAsPlannedNextAction()
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
		{#if $isPlanningMode}
			<button
				on:click={handleTogglePlanningMode}
				class="is-planning-mode"
			>
				Exit planning mode
			</button>
		{:else}
			<button
				on:click={handleTogglePlanningMode}
				class="is-not-planning-mode"
			>
				Enter planning mode
			</button>
		{/if}
		{#if plannedTasks.length > 0}
			<button on:click={onClearDoneTasks} class="clear-done-actions"
				>Clear done</button
			>
			<button on:click={onClearTasks} class="clear-all-planned-actions"
				>Clear all</button
			>
		{/if}
	</div>

	<div class="flow-planning-task-container"></div>

	<div class="flow-old-tasks">
		{#if oldPlannedTasks && oldPlannedTasks.length > 0}
			<hr />
			<p>
				Stale tasks have been cleared
				<button on:click={() => (showOldTasks = !showOldTasks)}>
					{showOldTasks ? 'Hide' : 'Show'}
				</button>
			</p>

			{#if showOldTasks}
				<div class="flow-old-tasks-list-container">
					{#each oldPlannedTasks as task}
						<a
							href="obsidian://open?vault={encodeURIComponent(
								plugin.dv.app.vault.getName(),
							)}&file={encodeURIComponent(
								task.link.path,
							)}#{encodeURIComponent(task.link.subpath)}"
							data-path="{task.link.path}#{task.link.subpath}"
							on:click={openTaskNote}>{task.text}</a
						>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
