import { Modal, Setting, ButtonComponent, debounce } from 'obsidian'
import { getProjectFilePath } from '../utils'
import FlowPlugin from '../main'

export class NewProjectModal extends Modal {
	private plugin: FlowPlugin
	private spheres: string[]
	private selectedSpheres: Set<string> = new Set()
	private onSubmit: (
		projectName: string,
		spheres: Set<string>,
		priority: number,
	) => void
	private projectName: string = ''
	private priority: number | undefined
	private sphereContainer: HTMLElement | null = null
	private sphereButtons: ButtonComponent[] = []

	constructor(
		plugin: FlowPlugin,
		onSubmit: (
			projectName: string,
			spheres: Set<string>,
			priority: number,
		) => void,
	) {
		super(plugin.app)
		this.plugin = plugin
		this.spheres = plugin.settings.spheres
		this.selectedSpheres = new Set()
		this.onSubmit = onSubmit
	}

	onOpen() {
		const { contentEl } = this

		contentEl.createEl('h2', {
			text: 'Create a new project and add next action',
		})

		new Setting(contentEl).setName('Project name').addText((text) =>
			text.onChange((value) => {
				this.projectName = value
			}),
		)

		this.sphereContainer = contentEl.createDiv()
		this.sphereContainer.addClass('flow-modal-content')

		const warningEl = contentEl.createDiv()
		warningEl.addClass('warning')

		this.spheres.forEach((sphere) => {
			const button = new ButtonComponent(
				this.sphereContainer as HTMLElement,
			)
			button.setButtonText(sphere)

			button.onClick(() => {
				warningEl.hide()

				if (this.selectedSpheres.has(sphere)) {
					this.selectedSpheres.delete(sphere)
					button.buttonEl.removeClass('selected')
				} else {
					this.selectedSpheres.add(sphere)
					button.setClass('selected')
				}
			})

			this.sphereButtons.push(button)
		})

		new Setting(contentEl).setName('Priority').addText((text) =>
			text.setPlaceholder('1-10').onChange(
				debounce(async (value) => {
					const num = parseInt(value)
					if (!isNaN(num) && num >= 1 && num <= 10) {
						warningEl.hide()
						this.priority = num
					} else {
						warningEl.setText(
							'Priority must be a number between 1 and 10',
						)
						warningEl.show()
						text.inputEl.value = this.priority?.toString() || ''
					}
				}, 500),
			),
		)

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText('Create')
				.setCta()
				.onClick(async () => {
					if (!this.projectName) {
						warningEl.setText('Please enter a project name')
						warningEl.show()
						return
					}
					if (this.selectedSpheres.size === 0) {
						warningEl.setText('Please select at least one sphere')
						warningEl.show()
						return
					}
					if (
						!this.priority ||
						this.priority < 1 ||
						this.priority > 10
					) {
						warningEl.setText(
							'Priority must be a number between 1 and 10',
						)
						warningEl.show()
						return
					}

					if (
						await getProjectFilePath(this.plugin, this.projectName)
					) {
						warningEl.setText('Project already exists')
						warningEl.show()
						return
					}

					this.onSubmit(
						this.projectName,
						this.selectedSpheres,
						this.priority,
					)
					this.close()
				}),
		)

		new Setting(contentEl).addButton((btn) =>
			btn.setButtonText('Cancel').onClick(() => {
				this.close()
			}),
		)
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
