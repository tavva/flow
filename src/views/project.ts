import { ItemView, WorkspaceLeaf } from 'obsidian'
// @ts-ignore
import ProjectComponent from '../components/ProjectView.svelte'
import FlowPlugin from '../main'

export const PROJECT_VIEW_TYPE = 'project-view'

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
		// @ts-ignore
		const dv = this.plugin.app.plugins.plugins['dataview'].api;

		const projects = dv
			.pages(`#project/${this.context}`)
			.filter((p) => p.status == "live" && !p.file.path.startsWith("Templates/"))
			.map((p) => ({
				...p,
				nextActions: p.file.tasks.filter(
					(t) => t.section?.subpath == "Next actions" && !t.completed
				),
			}))
			.filter((p) => p.nextActions.length > 0) // Only include projects with next actions
			.sort((p) => p.priority, "asc");


		console.log('projects', projects);

		this.setProps({ projects: projects });
	}

}
