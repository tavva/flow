<script lang="ts">
	import { onMount } from 'svelte'
	import type { Task } from '../tasks'
	import FlowPlugin from '../main'

	export let plugin: FlowPlugin

	let plannedTasks: Task[] = []

	onMount(() => {
		const unsubscribe = plugin.tasks.plannedTasks.subscribe((value) => {
			plannedTasks = value
		})

		return () => unsubscribe()
	})

	async function onClearTasks() {
		if (confirm('Are you sure you want to clear all tasks?')) {
			plugin.tasks.clearTasks()
		}
	}
</script>

<div class="flow-planning-view-container">
	<ul>
		{#each plannedTasks as task}
			<li>{task.title}</li>
		{/each}
	</ul>

	<button on:click={onClearTasks}>Clear tasks</button>
</div>
