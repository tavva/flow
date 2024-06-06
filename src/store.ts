import FlowPlugin from './main'
import _ from 'lodash'

export async function store(plugin: FlowPlugin, dataToStore: Object) {
	let data = (await plugin.loadData()) || {}
	const mergedData = _.merge(data, dataToStore)

	await plugin.saveData(mergedData)
}

export async function retrieve(plugin: FlowPlugin, key: string) {
	const data = (await plugin.loadData()) || {}

	return data[key]
}
