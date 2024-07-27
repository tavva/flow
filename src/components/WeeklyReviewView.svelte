<script lang="ts">
	import type FlowPlugin from 'main.js'

	import { WEEKLY_REVIEW_VIEW_TYPE } from 'views/weeklyReview.js'

	// export let plugin: FlowPlugin
	// export let sphere: string

	async function getTotalUnprocessedInboxCount() {
		return 3
	}

	async function getProjectsWithNoNextActions() {
		return ['Project 1', 'Project 2']
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
	<h1>Your weekly review</h1>

	<h2>Your inboxes</h2>
	{#await getTotalUnprocessedInboxCount()}
		<p>Loading...</p>
	{:then count}
		<p>You have {count} unprocessed drops in your inboxes</p>
	{:catch error}
		<p>Failed to load unprocessed drops: {error.message}</p>
	{/await}

	<h2>Projects with no next actions</h2>
	{#await getProjectsWithNoNextActions()}
		<p>Loading...</p>
	{:then projects}
		<ul>
			{#each projects as project}
				<li>{project} has nothing actionable. (Why is this bad?)</li>
			{/each}
		</ul>
	{:catch error}
		<p>Failed to load projects with no next actions: {error.message}</p>
	{/await}

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
