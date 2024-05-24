<script lang="ts">
	export let currentStage: 'inbox' | 'emailInbox' | null
	export let inboxCount: number
	export let emailInboxCount: number
	export let onNextStage: () => void

	function nextStage() {
		onNextStage()
	}
</script>

<div>
	<h2>Flow inbox status</h2>
	<p>Stage: {currentStage}</p>
	<p>Inbox count: {inboxCount}</p>
	<p>Folder count: {emailInboxCount}</p>
	{#if currentStage === null}
		<button on:click={nextStage}>Start Processing</button>
	{/if}
</div>
