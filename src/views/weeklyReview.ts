import { ItemView, WorkspaceLeaf, type ViewStateResult } from 'obsidian'

import type FlowPlugin from 'main.js'

import WeeklyReviewComponent from 'components/WeeklyReviewView.svelte'

export const WEEKLY_REVIEW_VIEW_TYPE = 'weekly-review-view'

interface WeeklyReviewViewState {
	sphere: string
}

export async function openWeeklyReviewView(plugin: FlowPlugin, sphere: string) {
	const { workspace } = plugin.app

	let leaf: WorkspaceLeaf | null = null
	const leaves = workspace.getLeavesOfType(WEEKLY_REVIEW_VIEW_TYPE)

	if (leaves.length > 0) {
		leaf = leaves[0]
	} else {
		leaf = workspace.getLeaf(true)
		await leaf!.setViewState({
			type: WEEKLY_REVIEW_VIEW_TYPE,
			active: true,
			state: { sphere: sphere },
		})
	}

	if (!leaf) {
		console.error(
			'Could not find or create a leaf for the weekly review view',
		)
		return
	}

	workspace.revealLeaf(leaf)
}

export class WeeklyReviewView
	extends ItemView
	implements WeeklyReviewViewState
{
	private component!: WeeklyReviewComponent
	plugin: FlowPlugin
	sphere: string

	constructor(leaf: WorkspaceLeaf, plugin: FlowPlugin) {
		super(leaf)
		this.sphere = ''
		this.plugin = plugin
	}

	async setState(
		state: WeeklyReviewViewState,
		result: ViewStateResult,
	): Promise<void> {
		if (state.sphere) {
			this.sphere = state.sphere
			this.setProps({ sphere: this.sphere })
		}
		return super.setState(state, result)
	}

	getState(): WeeklyReviewViewState {
		return {
			sphere: this.sphere,
		}
	}

	getViewType() {
		return WEEKLY_REVIEW_VIEW_TYPE
	}

	getDisplayText() {
		return 'Flow weekly review for ' + this.sphere + ' sphere'
	}

	override getIcon(): string {
		return 'waves'
	}

	public setProps(props: Partial<typeof this.component.$$.props>) {
		if (this.component) {
			this.component.$set(props)
		}
	}

	async onOpen() {
		this.component = new WeeklyReviewComponent({
			target: this.contentEl,
			props: {
				plugin: this.plugin,
			},
		})
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy()
		}
	}
}
