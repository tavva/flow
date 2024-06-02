import { ItemView, WorkspaceLeaf } from 'obsidian'
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

export class SphereView extends ItemView {
	private component: SphereComponent
	plugin: FlowPlugin
	sphere: string

	constructor(leaf: WorkspaceLeaf) {
		super(leaf)
	}

	getViewType() {
		return SPHERE_VIEW_TYPE
	}

	getDisplayText() {
		return 'Flow sphere view'
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
		this.setProps({ sphere: this.sphere })
		this.listProjectsWithNoNextActions()
	}

	public setProps(props: Partial<typeof this.component.$$.props>) {
		if (this.component) {
			this.component.$set(props)
		}
	}

	private async listProjectsWithNoNextActions() {
		const dv = getAPI()

		const projects = dv
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
					encodeURIComponent(dv.app.vault.getName()) +
					'&file=' +
					encodeURIComponent(p.file.path),
			}))
			.filter((p: Project) => p.nextActions.length > 0)
			.sort((p: Project) => p.priority, 'asc')

		this.setProps({ projects: projects, dv: dv })
	}
}
