import { ItemView, WorkspaceLeaf, type ViewStateResult } from 'obsidian'
import { STask } from 'obsidian-dataview'

import FlowPlugin from 'main.js'
import SphereComponent from 'components/SphereView.svelte'
import { listProjects } from 'utils.js'

export const SPHERE_VIEW_TYPE = 'sphere-view'

interface SphereViewState {
	sphere: string
}

export class SphereView extends ItemView implements SphereViewState {
	private component!: SphereComponent
	plugin: FlowPlugin
	sphere: string

	constructor(leaf: WorkspaceLeaf, plugin: FlowPlugin) {
		super(leaf)
		this.sphere = ''
		this.plugin = plugin
	}

	async setState(
		state: SphereViewState,
		result: ViewStateResult,
	): Promise<void> {
		if (state.sphere) {
			this.sphere = state.sphere
			this.render()
		}
		return super.setState(state, result)
	}

	getState(): SphereViewState {
		return {
			sphere: this.sphere,
		}
	}

	getViewType() {
		return SPHERE_VIEW_TYPE
	}

	getDisplayText() {
		let capitalized =
			this.sphere.charAt(0).toUpperCase() + this.sphere.slice(1)
		return capitalized + ' sphere dashboard'
	}

	override getIcon(): string {
		return 'waves'
	}

	async onOpen() {
		this.component = new SphereComponent({
			target: this.contentEl,
			props: {
				plugin: this.plugin,
				sphere: this.sphere,
			},
		})
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy()
		}
	}

	async render() {
		const projects = await listProjects(this.plugin, this.sphere)
		const nonProjectNextActions = await this.plugin.dv
			.page('Next actions')
			.file.tasks.filter(
				(t: STask) =>
					!t.completed && t.tags.includes(`#sphere/${this.sphere}`),
			)

		this.setProps({
			plugin: this.plugin,
			sphere: this.sphere,
			projects: projects,
			nonProjectNextActions: nonProjectNextActions,
		})
	}

	public setProps(props: Partial<typeof this.component.$$.props>) {
		if (this.component) {
			this.component.$set(props)
		}
	}
}
