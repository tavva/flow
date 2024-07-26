import { ItemView, WorkspaceLeaf } from 'obsidian'

import type FlowPlugin from 'main.js'

import WeeklyReviewComponent from 'components/WeeklyReviewView.svelte'

export const WEEKLY_REVIEW_VIEW_TYPE = 'weekly-review-view'

export class WeeklyReviewView extends ItemView {
	plugin: FlowPlugin
	private component!: WeeklyReviewComponent

	constructor(leaf: WorkspaceLeaf, plugin: FlowPlugin) {
		super(leaf)
		this.plugin = plugin
	}

	getViewType() {
		return WEEKLY_REVIEW_VIEW_TYPE
	}

	getDisplayText() {
		return 'Flow weekly review'
	}

	override getIcon(): string {
		return 'waves'
	}

	async onOpen() {
		this.component = new WeeklyReviewComponent({
			target: this.contentEl,
			// props: {
			// 	plugin: this.plugin,
			// },
		})
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy()
		}
	}
}
