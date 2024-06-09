<script lang="ts">
	import { onMount } from 'svelte'
	import type { STask } from 'obsidian-dataview'
	import { Component, WorkspaceLeaf } from 'obsidian'

	import FlowPlugin from '../main'
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

	async function renderTasks() {
		const taskContainer = document.getElementById(
			'flow-planning-task-container',
		)

		if (taskContainer) {
			taskContainer.empty()

			for (const task of plannedTasks) {
				await renderTask(task)
			}

			addCheckboxListeners()
		}
	}

	async function renderTask(task: Task) {
		const taskContainer = document.getElementById(
			'flow-planning-task-container',
		)
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
			await plugin.dv.taskList(taskList, false, taskContainer, component)
			component.load()
		} catch (error) {
			console.error('Error rendering task list:', error)
		}
	}

	function addCheckboxListeners() {
		const taskContainer = document.getElementById(
			'flow-planning-task-container',
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

	function refreshSphereViews() {
		plugin.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
			if (leaf.view.getViewType() === SPHERE_VIEW_TYPE) {
				;(leaf.view as any).render()
				console.log(`Refreshed view of type ${SPHERE_VIEW_TYPE}`)
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
	<div id="flow-planning-task-container"></div>

	<button on:click={onClearTasks}>Clear tasks</button>
</div>
