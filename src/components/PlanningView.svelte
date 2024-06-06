<script lang="ts">
	import type { Task } from '../planning'

	export let tasks: Task[]
</script>

<div class="flow-planning-view-container">
	<ul>
		{#each tasks as task}
			<li>{task.title}</li>
		{/each}
	</ul>
</div>
