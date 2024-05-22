<script lang="ts">
	export let inboxCount: number
	export let emailInboxCount: number
	export let currentStage: string
	export let goToInbox: () => void
	export let goToEmailInbox: () => void

	function handleGoToInbox() {
		if (inboxCount > 0) goToInbox()
	}

	function handleGoToEmailInbox() {
		if (emailInboxCount > 0) goToEmailInbox()
	}
</script>

<div>
	<h3>Processing Status</h3>
	<p>Inbox lines: {inboxCount}</p>
	<p>Email Inbox files: {emailInboxCount}</p>
	<p>Current Stage: {currentStage}</p>
	<button on:click={handleGoToInbox} disabled={inboxCount === 0}
		>Go to Inbox</button
	>
	<button on:click={handleGoToEmailInbox} disabled={emailInboxCount === 0}
		>Go to Email Inbox</button
	>
</div>
