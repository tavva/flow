import { ItemView, ViewStateResult, WorkspaceLeaf } from 'obsidian'
import { getAPI, DataviewApi, STask } from 'obsidian-dataview'
// @ts-ignore
import SphereComponent from '../components/SphereView.svelte'
import FlowPlugin from '../main'

export const SPHERE_VIEW_TYPE = 'sphere-view'

export interface Project {
	file: {
		name: string
		path: string
		tasks: DataviewApi.TaskResult
	}
	status: string
	priority: number
	nextActions: DataviewApi.TaskResult
	link: string
}

interface SphereViewState {
	sphere: string
}

export class SphereView extends ItemView implements SphereViewState {
	private component: SphereComponent
	plugin: FlowPlugin
	sphere: string
	dv: DataviewApi

	constructor(leaf: WorkspaceLeaf) {
		super(leaf)
		this.dv = getAPI()
		this.sphere = ''
	}

	async setState(
		state: SphereViewState,
		result: ViewStateResult,
	): Promise<void> {
		if (state.sphere) this.sphere = state.sphere
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
		return capitalized + ' dashboard'
	}

	async onOpen() {
		this.component = new SphereComponent({
			target: this.contentEl,
			props: {
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
		const projects = await this.listProjects()
		const nonProjectNextActions = await this.dv
			.page('Next actions')
			.file.tasks.filter(
				(t: STask) =>
					!t.completed && t.tags.includes(`#context/${this.sphere}`),
			)

		this.setProps({
			dv: this.dv,
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

	private async listProjects() {
		return this.dv
			.pages(`#project/${this.sphere}`)
			.filter(
				(p: Project) =>
					p.status == 'live' && !p.file.path.startsWith('Templates/'),
			)
			.map((p: Project) => ({
				...p,
				nextActions: p.file.tasks.filter(
					(t: STask) =>
						t.section?.subpath == 'Next actions' && !t.completed,
				),
				link:
					'obsidian://open?vault=' +
					encodeURIComponent(this.dv.app.vault.getName()) +
					'&file=' +
					encodeURIComponent(p.file.path),
			}))
			.sort((p: Project) => p.priority, 'asc')
	}
}
