<script lang="ts">
	import type FlowPlugin from 'main'

	import { getMissingDependencies } from 'dependencies'
	import {
		createFilesFromSettings,
		getInvalidSettings,
	} from 'settings/settings'
	import type { SettingDefinition } from 'settings/definitions'
	import { SETUP_VIEW_TYPE } from 'views/setup'

	export let plugin: FlowPlugin

	let settingsData: [string, SettingDefinition<any>][] | null = null
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

	function handleCreateFilesFromSettings() {
		createFilesFromSettings(plugin)
	}

	async function handleRestartFlow() {
		// @ts-ignore
		await plugin.app.plugins.disablePlugin('flow')
		// @ts-ignore
		await plugin.app.plugins.enablePlugin('flow')

		const { workspace } = plugin.app
		workspace.detachLeavesOfType(SETUP_VIEW_TYPE)
	}
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
							<li>
								<a
									href="https://obsidian.md/plugins?id={plugin}"
									>{pluginName}</a
								>
							</li>
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
							{#each settingsData as [info, _setting]}
								<li>{info}</li>
							{/each}
						</ul>
						<button on:click={handleCreateFilesFromSettings}
							>Automatically create files and folders from
							settings</button
						>
					{/if}
				{/key}
			{/if}
		</p>

		{#if dependenciesData?.length === 0 && settingsData?.length === 0}
			<strong>You're all set!</strong>
			<button on:click={handleRestartFlow}
				>Restart Flow to start using it</button
			>
		{/if}
	</div>
</div>
