<script lang="ts">
	export let inboxCount: number
	export let emailInboxCount: number
	export let currentStage: string

	function goToInbox() {}

	function goToEmailInbox() {}
</script>

<div>
	<h3>Processing Status</h3>
	<p>Inbox lines: {inboxCount}</p>
	<p>Email Inbox files: {emailInboxCount}</p>
	<p>Current Stage: {currentStage}</p>
	<button on:click={goToInbox} disabled={inboxCount === 0}>Go to Inbox</button
	>
	<button on:click={goToEmailInbox} disabled={emailInboxCount === 0}
		>Go to Email Inbox</button
	>
</div>
