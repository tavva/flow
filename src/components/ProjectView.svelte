<script lang="ts">
	export let context: string
	export let projects: any
</script>

<div class="flow-project">
	<h1>{context}</h1>
	<div>
		{#if projects && projects.length > 0}
			<ul>
				{#each projects as project}
					<li>
						{project.file.name}
					</li>
				{/each}
			</ul>
		{:else}
			<p>No projects found</p>
		{/if}
	</div>
</div>
