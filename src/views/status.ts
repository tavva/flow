import { ItemView, WorkspaceLeaf } from 'obsidian'
import StatusViewComponent from '../components/StatusView.svelte'

export const STATUS_VIEW_TYPE = 'status-view'

export class StatusView extends ItemView {
	private component: StatusViewComponent

	constructor(leaf: WorkspaceLeaf) {
		super(leaf)
	}

	getViewType() {
		return STATUS_VIEW_TYPE
	}

	getDisplayText() {
		return 'GTD Status View'
	}

	async onOpen() {
		this.component = new StatusViewComponent({
			target: this.contentEl,
			props: {
				currentStage: null,
				inboxCount: 0,
				emailInboxCount: 0,
				onNextStage: () => {},
			},
		})
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy()
		}
	}

	public setProps(props: Partial<typeof this.component.$$.props>) {
		if (this.component) {
			this.component.$set(props)
		}
	}
}
