// Credits go to Liam's Periodic Notes Plugin: https://github.com/liamcain/obsidian-periodic-notes

import { TAbstractFile, TFile } from 'obsidian'
import { TextInputSuggest } from './suggest'
import { getTFilesFromFolder } from '../../utils'
import FlowPlugin from '../../main'

export class FileSuggest extends TextInputSuggest<TFile> {
	constructor(
		public inputEl: HTMLInputElement,
		private plugin: FlowPlugin,
	) {
		super(inputEl)
	}

	getSuggestions(input_str: string): TFile[] {
		const all_files = getTFilesFromFolder('')
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
