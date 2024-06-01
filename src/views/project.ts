import { ItemView, WorkspaceLeaf } from 'obsidian'
import { getAPI, DataviewApi, STask } from 'obsidian-dataview'
// @ts-ignore
import ProjectComponent from '../components/ProjectView.svelte'
import FlowPlugin from '../main'

export const PROJECT_VIEW_TYPE = 'project-view'

interface Project {
	file: {
		name: string
		path: string
		tasks: DataviewApi.TaskResult
	}
	status: string
	priority: number
	nextActions: DataviewApi.TaskResult
}

export class ProjectView extends ItemView {
	private component: ProjectComponent
	plugin: FlowPlugin
	context: string

	constructor(leaf: WorkspaceLeaf) {
		super(leaf)
	}

	getViewType() {
		return PROJECT_VIEW_TYPE
	}

	getDisplayText() {
		return 'Flow project view'
	}

	async onOpen() {
		this.component = new ProjectComponent({
			target: this.contentEl,
			props: {
				context: this.context,
			},
		})
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy()
		}
	}

	async render() {
		this.setProps({ context: this.context })
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
			.pages(`#project/${this.context}`)
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
			}))
			.filter((p: Project) => p.nextActions.length > 0)
			.sort((p: Project) => p.priority, 'asc')

		this.setProps({ projects: projects, dv: dv })
	}
}
