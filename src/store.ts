import FlowPlugin from './main'
import _ from 'lodash'

export async function store(plugin: FlowPlugin, dataToStore: Object) {
	let data = (await plugin.loadData()) || {}
	const mergedData = _.merge(data, dataToStore)

	console.log(mergedData)
	await plugin.saveData(mergedData)
}
