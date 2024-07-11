<script lang="ts">
	import type FlowPlugin from 'main'

	import { getMissingDependencies } from 'dependencies'

	export let plugin: FlowPlugin

	$: settingsMessage = ''

	$: missingDependencies = getMissingDependencies(plugin)

	$: dependenciesMessage =
		missingDependencies.length === 0
			? 'All dependencies are installed.'
			: 'You need to install and enable some dependencies.'

	setInterval(() => {
		missingDependencies = getMissingDependencies(plugin)
	}, 1000)
</script>

<div>
	<h1>Flow setup</h1>
	<p>Welcome to Flow.</p>

	<div class="flow-checks">
		<h3>Dependencies</h3>
		<p class="dependencies">{dependenciesMessage}</p>
		<ul>
			{#each missingDependencies as [dependency, dependencyName]}
				<li>{dependencyName} ({dependency})</li>
			{/each}
		</ul>

		<h3>Settings</h3>
		<p class="settings">{settingsMessage}</p>
	</div>
</div>
