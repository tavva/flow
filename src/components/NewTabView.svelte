<script lang="ts">
	import { moment } from 'obsidian'
	import store from 'svelteStore.js'
	import type FlowPlugin from 'main.js'

	let plugin!: FlowPlugin
	store.plugin.subscribe((p: FlowPlugin) => (plugin = p))

	async function getDaysSinceInstallation() {
		const installationTimestamp =
			await plugin.store.retrieve('install-time')

		// @ts-ignore
		const installationDate = moment(installationTimestamp)

		const currentDate = moment.utc()
		const daysDiff = currentDate.diff(installationDate, 'days')

		return daysDiff
	}

	async function getMetrics() {
		const daysDiff = await getDaysSinceInstallation()
		if (daysDiff === 0) {
			return {}
		}
		const metrics: Record<string, number> = {}

		metrics['inboxItemsProcessed'] =
			plugin.metrics.get('line-processed') +
			plugin.metrics.get('file-processed')
		metrics['newActionsCreated'] =
			plugin.metrics.get('action-created') +
			plugin.metrics.get('project-action-created')

		metrics['inboxItemsProcessedPerDay'] =
			metrics['inboxItemsProcessed'] / daysDiff
		metrics['newActionsCreatedPerDay'] =
			metrics['newActionsCreated'] / daysDiff

		return metrics
	}
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

	{#await getMetrics() then metrics}
		{#if Object.keys(metrics).length === 0}
			<p>We'll show you metrics here after a day of using Flow</p>
		{:else}
			<p>
				You have processed {metrics['inboxItemsProcessed']} inbox items.
			</p>
			<p>
				From these, you have created {metrics['newActionsCreated']} new next
				actions!
			</p>

			<p>
				That's {metrics['inboxItemsProcessedPerDay'].toFixed(1)} inbox items
				processed per day, and {metrics[
					'newActionsCreatedPerDay'
				].toFixed(1)} new actions created per day.
			</p>
		{/if}
	{/await}
</div>
