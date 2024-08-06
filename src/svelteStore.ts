import { writable } from 'svelte/store'

import type FlowPlugin from './main.js'

const plugin = writable<FlowPlugin>()
export default { plugin }
