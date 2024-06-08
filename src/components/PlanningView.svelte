<script lang="ts">
	import { onMount } from 'svelte'
	import type { STask } from 'obsidian-dataview'
	import { Component } from 'obsidian'
	import { TaskType, type Task } from '../tasks'
	import FlowPlugin from '../main'

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
				let taskList: STask[] = []

				if (task.type == TaskType.PROJECT) {
					taskList = plugin.dv
						.page(task.projectPath)
						.file.tasks.filter((t: STask) => t.text === task.title)
				} else {
					taskList = plugin.dv
						.page(plugin.settings.nextActionsFilePath)
						.file.tasks.filter((t: STask) => t.text === task.title)
				}

				try {
					const component = new Component()
					await plugin.dv.taskList(
						taskList,
						false,
						taskContainer,
						component,
					)
					component.load()
				} catch (error) {
					console.error('Error rendering task list:', error)
				}
			}
		}
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
