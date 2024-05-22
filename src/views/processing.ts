import { ItemView, WorkspaceLeaf } from 'obsidian'
import InboxViewComponent from '../components/InboxView.svelte'

export const PROCESSING_VIEW_TYPE = 'processing-view'

export class ProcessingView extends ItemView {
	private component: InboxViewComponent

	constructor(leaf: WorkspaceLeaf) {
		super(leaf)
	}

	getViewType() {
		return PROCESSING_VIEW_TYPE
	}

	getDisplayText() {
		return 'GTD Processing View'
	}

	async onOpen() {
		this.component = new InboxViewComponent({
			target: this.contentEl,
			props: {
				line: '',
				onAddToNextActions: () => {},
				onAddToProject: () => {},
				onTrash: () => {},
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
