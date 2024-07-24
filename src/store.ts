import _ from 'lodash'

import FlowPlugin from 'main.js'

export class Store {
	plugin: FlowPlugin

	constructor(plugin: FlowPlugin) {
		this.plugin = plugin
	}

	async delete(key: string) {
		let data = (await this.plugin.loadData()) || {}
		delete data[key]

		await this.plugin.saveData(data)
	}

	async store(dataToStore: Object) {
		let data = (await this.plugin.loadData()) || {}
		const mergedData = _.merge(data, dataToStore)

		await this.plugin.saveData(mergedData)
	}

	async retrieve(key: string) {
		const data = (await this.plugin.loadData()) || {}

		return data[key]
	}
}
