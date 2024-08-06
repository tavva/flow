<script lang="ts">
	import store from 'svelteStore.js'
	import type FlowPlugin from 'main.js'

	let plugin: FlowPlugin
	store.plugin.subscribe((p: FlowPlugin) => (plugin = p))
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
