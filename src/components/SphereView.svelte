<script lang="ts">
	import { tick } from 'svelte'
	import { Component } from 'obsidian'

	import type { DataviewApi } from 'obsidian-dataview'
	import type { Project } from '../views/sphere'

	export let dv: DataviewApi
	export let sphere: string
	export let projects: Project[] = []

	let projectsWithNextActions: Project[] = []
	let projectsNeedingNextActions: Project[] = []

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
		if (projectsWithNextActions.length > 0) {
			tick().then(() => {
				projectsWithNextActions.forEach((project) => {
					const projectId = `task-list-${generateUniqueProjectId(project.file.path)}`
					const container = document.getElementById(projectId)
					if (container) {
						renderTaskList(container, project.nextActions)
					}
				})
			})
		}
	}
</script>

<div class="flow-project">
	<h1>{sphere}</h1>
	<div>
		{#if projectsWithNextActions && projectsWithNextActions.length > 0}
			<ul>
				{#each projectsWithNextActions as project}
					<li>
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
</div>
