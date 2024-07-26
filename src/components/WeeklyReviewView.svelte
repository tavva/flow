<script lang="ts">
	import type FlowPlugin from 'main.js'

	import { WEEKLY_REVIEW_VIEW_TYPE } from 'views/weeklyReview.js'

	// export let plugin: FlowPlugin
</script>

<div>
	<h1>Your weekly review</h1>
	<h2>Your inboxes</h2>
	<p>You have 3 unprocessed drops in your inboxes</p>
	<h2>Projects with no next actions</h2>
	<ul>
		<li>Blah project name has nothing actionable. (Why is this bad?)</li>
	</ul>
	<h2>Projects with too many next actions</h2>
	<ul>
		<li>
			Another project name has 7 next actions. This is possible, but can
			indicate bad next action management. (Why is this bad?)
		</li>
	</ul>
	<h2>Waiting for actions with no chase date</h2>
	<ul>
		<li>
			Blah project name has 3 waiting for actions with no chase date. (Why
			is this bad?)
		</li>
	</ul>
	<h2>Projects that haven't been modified in a while</h2>
	<ul>
		<li>
			Blah project name hasn't been modified in 2 weeks. (Why is this
			bad?)
		</li>
		<li>
			Another project name hasn't been modified in 3 weeks. (Why is this
			bad?)
		</li>
	</ul>
</div>
