import FlowPlugin from './main'

export class Metrics {
	private plugin: FlowPlugin
	private counts: { [key: string]: number }

	constructor(plugin: FlowPlugin) {
		this.plugin = plugin
		this.loadCounts()
	}

	private async loadCounts() {
		const data = await this.plugin.loadData()
		this.counts = data?.counts || {}
	}

	private async saveCounts() {
		const data = (await this.plugin.loadData()) || {}
		data.counts = this.counts
		await this.plugin.saveData(data)
	}

	public async count(metric: string) {
		if (!this.counts[metric]) {
			this.counts[metric] = 0
		}
		this.counts[metric]++
		await this.saveCounts()
	}

	public get(metric: string): number {
		return this.counts[metric] || 0
	}
}
