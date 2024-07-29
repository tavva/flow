<script lang="ts">
	import type FlowPlugin from 'main.js'

	export let plugin: FlowPlugin
</script>

<div>
	<button
		on:click={() =>
			// @ts-ignore
			plugin.app.commands.executeCommandById('flow:start-processing')}
		>Process</button
	>
	then
	<button
		on:click={() =>
			// @ts-ignore
			plugin.app.commands.executeCommandById('flow:open-planning-view')}
		>Plan</button
	>
</div>
