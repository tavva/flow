import { DateTime } from 'luxon'

import { ItemView, WorkspaceLeaf, type ViewStateResult } from 'obsidian'
import { DataviewApi, STask, SMarkdownPage } from 'obsidian-dataview'
// @ts-ignore
import SphereComponent from 'components/SphereView.svelte'
import FlowPlugin from 'main.js'

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
		const projects = await this.listProjects()
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

	private async listProjects(): Promise<SMarkdownPage[]> {
		const now = DateTime.now()
		const oneDayAhead = now.plus({ days: 1 })

		return await this.plugin.dv
			.pages(`#project/${this.sphere}`)
			.filter(
				(p: SMarkdownPage) =>
					p.status == 'live' && !p.file.path.startsWith('Templates/'),
			)
			.map((p: SMarkdownPage) => ({
				...p,
				nextActions: p.file.tasks.filter(
					(t: STask) =>
						t.section?.subpath == 'Next actions' && !t.completed,
				),
				link:
					'obsidian://open?vault=' +
					encodeURIComponent(this.plugin.dv.app.vault.getName()) +
					'&file=' +
					encodeURIComponent(p.file.path),
			}))
			.map((p: SMarkdownPage) => ({
				...p,
				hasActionables: p.nextActions.some((t: STask) => {
					return (
						t.status != 'w' &&
						(t.due == undefined || t.due <= oneDayAhead)
					)
				}),
			}))
			// This sorts by priority, then by projects that have actionables,
			// then by file name
			.sort((p: SMarkdownPage) => p.file.name, 'asc')
			.sort((p: SMarkdownPage) => p.hasActionables, 'desc')
			.sort((p: SMarkdownPage) => p.priority, 'asc')
	}
}
