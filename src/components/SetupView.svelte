<script lang="ts">
	import type FlowPlugin from 'main'

	import { getMissingDependencies } from 'dependencies'
	import { getInvalidSettings } from 'settings/settings'

	export let plugin: FlowPlugin

	let settingsData: string[] | null = null
	let dependenciesData: string[][] | null = null

	async function updateDependencies() {
		dependenciesData = await getMissingDependencies(plugin)
		dependenciesData = dependenciesData
	}

	async function updateSettings() {
		settingsData = await getInvalidSettings(plugin)
		settingsData = settingsData
	}

	setInterval(() => {
		updateDependencies()
		updateSettings()
	}, 1000)
</script>

<div>
	<h1>Flow setup</h1>
	<p>Welcome to Flow.</p>

	<div class="flow-checks">
		<h3>Dependencies</h3>
		<p class="dependencies">
			{#if dependenciesData}
				{#if dependenciesData.length === 0}
					<p>All dependencies are installed!</p>
				{:else}
					<ul>
						{#each dependenciesData as [pluginName, plugin]}
							<li>{pluginName} ({plugin})</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</p>

		<h3>Settings</h3>
		<p class="settings">
			{#if settingsData}
				{#key settingsData}
					{#if settingsData.length === 0}
						<p>All settings are set up correctly.</p>
					{:else}
						<ul>
							{#each settingsData as info}
								<li>{info}</li>
							{/each}
						</ul>
					{/if}
				{/key}
			{/if}
		</p>
	</div>
</div>
