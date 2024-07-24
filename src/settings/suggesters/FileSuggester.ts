// Credits go to Liam's Periodic Notes Plugin: https://github.com/liamcain/obsidian-periodic-notes

import { TAbstractFile, TFile } from 'obsidian'

import FlowPlugin from 'main.js'
import { TextInputSuggest } from 'settings/suggesters/suggest.js'
import { getTFilesFromFolder } from 'utils.js'

export class FileSuggest extends TextInputSuggest<TFile> {
	constructor(
		public plugin: FlowPlugin,
		public inputEl: HTMLInputElement,
	) {
		super(plugin, inputEl)
	}

	getSuggestions(input_str: string): TFile[] {
		const all_files = getTFilesFromFolder(this.plugin, '')
		if (!all_files) {
			return []
		}

		const files: TFile[] = []
		const lower_input_str = input_str.toLowerCase()

		all_files.forEach((file: TAbstractFile) => {
			if (
				file instanceof TFile &&
				file.extension === 'md' &&
				file.path.toLowerCase().contains(lower_input_str)
			) {
				files.push(file)
			}
		})

		return files.slice(0, 1000)
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path)
	}

	selectSuggestion(file: TFile): void {
		this.inputEl.value = file.path
		this.inputEl.trigger('input')
		this.close()
	}
}
