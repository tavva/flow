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
	<h2>Status</h2>
	<p>Current Stage: {currentStage}</p>
	<p>Inbox Count: {inboxCount}</p>
	<p>Email Inbox Count: {emailInboxCount}</p>
	{#if currentStage === null}
		<button on:click={nextStage}>Start Processing</button>
	{/if}
</div>
