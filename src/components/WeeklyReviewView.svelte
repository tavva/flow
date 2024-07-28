<script lang="ts">
	import { onMount } from 'svelte'

	import type FlowPlugin from 'main.js'
	import { listProjects } from 'utils.js'

	// TODO: why is plugin not being passed through as a prop
	export let plugin: FlowPlugin
	export let sphere: string

	onMount(() => {
		setInterval(async () => {
			totalUnprocessedInboxCount = await getTotalUnprocessedInboxCount()
			projectsWithNoNextActions = await getProjectsWithNoNextActions()
			projectsWithTooManyNextActions =
				await getProjectsWithTooManyNextActions()
			waitingForActionsWithNoChaseDate =
				await getWaitingForActionsWithNoChaseDate()
			projectsThatHaventBeenModifiedInAWhile =
				await getProjectsThatHaventBeenModifiedInAWhile()
		}, 1000)
	})

	let totalUnprocessedInboxCount: number
	let projectsWithNoNextActions: string[]
	let projectsWithTooManyNextActions: {
		name: string
		nextActions: string[]
	}[]
	let waitingForActionsWithNoChaseDate: {
		projectName: string
		count: number
	}[]
	let projectsThatHaventBeenModifiedInAWhile: {
		name: string
		daysSinceLastModified: number
	}[]

	async function getTotalUnprocessedInboxCount() {
		plugin.stateManager.updateCounts()
		return (
			plugin.stateManager.linesToProcess.length +
			plugin.stateManager.filesToProcess.length
		)
	}

	async function getProjectsWithNoNextActions() {
		console.log('plugin', this.plugin)
		const projects = await listProjects(this.plugin, this.sphere)
		return projects
			.filter((project) => project.hasActionables === false)
			.map((project) => project.name)
	}

	async function getProjectsWithTooManyNextActions() {
		return [
			{
				name: 'Project 1',
				nextActions: [
					'Action 1',
					'Action 2',
					'Action 3',
					'Action 4',
					'Action 5',
					'Action 6',
					'Action 7',
					'Action 8',
					'Action 9',
					'Action 10',
				],
			},
			{
				name: 'Project 2',
				nextActions: [
					'Action 1',
					'Action 2',
					'Action 3',
					'Action 4',
					'Action 5',
					'Action 6',
					'Action 7',
					'Action 8',
					'Action 9',
					'Action 10',
				],
			},
		]
	}

	async function getWaitingForActionsWithNoChaseDate() {
		return [
			{
				projectName: 'Project 1',
				count: 3,
			},
			{
				projectName: 'Project 2',
				count: 5,
			},
		]
	}

	async function getProjectsThatHaventBeenModifiedInAWhile() {
		return [
			{
				name: 'Project 1',
				daysSinceLastModified: 10,
			},
			{
				name: 'Project 2',
				daysSinceLastModified: 20,
			},
		]
	}
</script>

<div>
	<h1>Your weekly review for {sphere}</h1>

	<h2>Your inboxes</h2>
	{#if totalUnprocessedInboxCount === undefined}
		<p>Loading...</p>
	{:else if totalUnprocessedInboxCount === 0}
		<p>All your inboxes are empty, good job</p>
	{:else}
		<p>
			You have {totalUnprocessedInboxCount} unprocessed drops in your inboxes
		</p>
	{/if}

	<h2>Projects with no next actions</h2>
	{#if projectsWithNoNextActions === undefined}
		<p>Loading...</p>
	{:else if projectsWithNoNextActions.length > 0}
		<ul>
			{#each projectsWithNoNextActions as project}
				<li>{project} has nothing actionable. (Why is this bad?)</li>
			{/each}
		</ul>
	{:else}
		<p>All your projects have next actions, good job</p>
	{/if}

	<h2>Projects with too many next actions</h2>
	{#await getProjectsWithTooManyNextActions()}
		<p>Loading...</p>
	{:then projects}
		<ul>
			{#each projects as project}
				<li>
					{project.name} has {project.nextActions.length} next actions.
					(Why is this bad?)
				</li>
			{/each}
		</ul>
	{:catch error}
		<p>
			Failed to load projects with too many next actions: {error.message}
		</p>
	{/await}

	<h2>Waiting for actions with no chase date</h2>
	{#await getWaitingForActionsWithNoChaseDate()}
		<p>Loading...</p>
	{:then actions}
		<ul>
			{#each actions as action}
				<li>
					{action.projectName} has {action.count} waiting for actions with
					no chase date. (Why is this bad?)
				</li>
			{/each}
		</ul>
	{:catch error}
		<p>
			Failed to load waiting for actions with no chase date: {error.message}
		</p>
	{/await}

	<h2>Projects that haven't been modified in a while</h2>
	{#await getProjectsThatHaventBeenModifiedInAWhile()}
		<p>Loading...</p>
	{:then projects}
		<ul>
			{#each projects as project}
				<li>
					{project.name} hasn't been modified in {project.daysSinceLastModified}
					days. (Why is this bad?)
				</li>
			{/each}
		</ul>
	{:catch error}
		<p>
			Failed to load projects that haven't been modified in a while: {error.message}
		</p>
	{/await}
</div>
