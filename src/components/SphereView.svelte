<script lang="ts">
	import { tick } from 'svelte'
	import { Component } from 'obsidian'
	import type { DataviewApi } from 'obsidian-dataview'

	import FlowPlugin from '../main'
	import type { Project } from '../views/sphere'
	import {
		togglePlanningMode,
		isPlanningMode,
		addTaskClickListeners,
	} from './planning'

	let taskContainer: HTMLElement

	export let plugin: FlowPlugin
	export let dv: DataviewApi
	export let sphere: string
	export let projects: Project[] = []
	let sphereCapitalised: string = ''

	let projectsWithNextActions: Project[] = []
	let projectsNeedingNextActions: Project[] = []

	export let nonProjectNextActions: DataviewApi.TaskResult = []

	$: if (sphere) {
		sphereCapitalised = sphere.charAt(0).toUpperCase() + sphere.slice(1)
	}

	$: {
		isPlanningMode
	}

	async function renderTaskList(container: HTMLElement, tasks: any) {
		if (container && tasks) {
			try {
				const component = new Component()
				await dv.taskList(tasks, false, container, component)
				component.load()
			} catch (error) {
				console.error('Error rendering task list:', error)
			}
		}

		addTaskClickListeners(plugin, container)
	}

	function generateUniqueProjectId(path: string): string {
		return path.replace(/[^\w-]+/g, '-')
	}

	$: {
		if (projects.length > 0) {
			projectsWithNextActions = projects.filter(
				(project) => project.nextActions.length > 0,
			)
			projectsNeedingNextActions = projects.filter(
				(project) => project.nextActions.length === 0,
			)
		}
	}

	$: {
		if (plugin && projectsWithNextActions.length > 0) {
			tick().then(() => {
				projectsWithNextActions.forEach((project) => {
					const projectId = `task-list-${generateUniqueProjectId(project.file.path)}`
					const container = document.getElementById(projectId)
					if (container) {
						container.empty()
						renderTaskList(container, project.nextActions)
					}
				})
			})
		}
	}

	$: {
		if (plugin && nonProjectNextActions.length > 0) {
			tick().then(() => {
				const container = document.getElementById(
					'task-list-non-project',
				)
				if (container) {
					container.empty()
					renderTaskList(container, nonProjectNextActions)
				}
			})
		}
	}
</script>

<div class="flow-project">
	<h1>{sphereCapitalised}</h1>
	<button on:click={togglePlanningMode}>
		{#if $isPlanningMode}
			Exit Planning Mode
		{/if}
		{#if !$isPlanningMode}
			Enter Planning Mode
		{/if}
	</button>
	<div>
		{#if projectsNeedingNextActions && projectsNeedingNextActions.length > 0}
			<h2>You have projects that need next actions</h2>
			<ul>
				{#each projectsNeedingNextActions as project}
					<li>
						<a href={project.link}>{project.file.name}</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
	<div id="flow-task-lists" bind:this={taskContainer}>
		<h2>Projects</h2>
		{#if projectsWithNextActions && projectsWithNextActions.length > 0}
			<ul>
				{#each projectsWithNextActions as project}
					<li>
						{project.priority}.
						<a href={project.link}>{project.file.name}</a>
						<div
							id={`task-list-${generateUniqueProjectId(project.file.path)}`}
						></div>
					</li>
				{/each}
			</ul>
		{:else}
			<p>No projects found</p>
		{/if}
	</div>
	<div>
		<h2>Non-project next actions</h2>
		<div id="task-list-non-project">No non-project next actions</div>
	</div>
</div>
