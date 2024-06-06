import FlowPlugin from './main'
import { store } from './store.ts'

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

	public async count(metric: string) {
		if (!this.counts[metric]) {
			this.counts[metric] = 0
		}
		this.counts[metric]++
		await store(this.plugin, this.counts)
	}

	public get(metric: string): number {
		return this.counts[metric] || 0
	}
}
