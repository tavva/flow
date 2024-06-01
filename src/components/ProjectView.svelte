<script lang="ts">
	import { afterUpdate } from 'svelte'
	import { Component } from 'obsidian'

	import type { DataviewApi } from 'obsidian-dataview'

	export let context: string
	export let projects: any[]
	export let dv: DataviewApi

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

	afterUpdate(() => {
		if (projects && projects.length > 0) {
			projects.forEach((project: any, index: number) => {
				const container = document.getElementById(`task-list-${index}`)
				if (container) {
					renderTaskList(container, project.nextActions)
				}
			})
		}
	})
</script>

<div class="flow-project">
	<h1>{context}</h1>
	<div>
		{#if projects && projects.length > 0}
			<ul>
				{#each projects as project, index}
					<li>
						{project.file.name}
						<div id={'task-list-' + index}></div>
					</li>
				{/each}
			</ul>
		{:else}
			<p>No projects found</p>
		{/if}
	</div>
</div>
