<script lang="ts">
	import store from '../svelteStore.js'
	import type FlowPlugin from '../main.js'

	import { getMissingDependencies } from '../dependencies.js'
	import {
		createFilesFromSettings,
		getInvalidSettings,
	} from '../settings/settings.js'
	import type { SettingDefinition } from '../settings/definitions.js'
	import { SETUP_VIEW_TYPE } from '../views/setup.js'

	let plugin: FlowPlugin
	store.plugin.subscribe((p: FlowPlugin) => (plugin = p))

	let settingsData: [string, SettingDefinition<any>][] | null = null
	let dependenciesData: string[][] | null = null

	async function updateDependencies() {
		dependenciesData = getMissingDependencies(plugin)
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
			<hr />
			<div class="flow-setup-complete">
				<p><strong>You're all set!</strong></p>
				<button on:click={handleRestartFlow}
					>Restart Flow to start using it</button
				>
			</div>
		{/if}
	</div>
</div>
