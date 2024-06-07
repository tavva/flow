import _ from 'lodash'

import FlowPlugin from './main'

export class Store {
	plugin: FlowPlugin

	constructor(plugin: FlowPlugin) {
		this.plugin = plugin
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
