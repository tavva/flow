import FlowPlugin from 'main'

export class Metrics {
	private plugin: FlowPlugin
	private counts: { [key: string]: number }

	constructor(plugin: FlowPlugin) {
		this.plugin = plugin
		this.counts = {}
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
		await this.plugin.store.store({ counts: this.counts })
	}

	public get(metric: string): number {
		return this.counts[metric] || 0
	}
}
