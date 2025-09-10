/** @jest-environment node */

jest.mock('lodash', () => ({ __esModule: true, default: {
  merge: (target: any, source: any) => {
    const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v)
    const deepMerge = (t: any, s: any) => {
      t = t || {}
      for (const k of Object.keys(s)) {
        if (isObj(s[k])) {
          t[k] = deepMerge(t[k] || {}, s[k])
        } else {
          t[k] = s[k]
        }
      }
      return t
    }
    return deepMerge(target, source)
  }
} }), { virtual: true })

import { Store } from '../src/store.js'
import { Metrics } from '../src/metrics.js'

function makePluginWithData(initial: any = {}) {
  let data: any = { ...initial }
  return {
    loadData: async () => ({ ...data }),
    saveData: async (d: any) => { data = d },
  } as any
}

describe('Store and Metrics', () => {
  test('Store.store merges and retrieve/delete work', async () => {
    const plugin = makePluginWithData({ a: 1, nested: { b: 2 } })
    const store = new Store(plugin)
    await store.store({ nested: { c: 3 }, x: 9 })
    expect(await store.retrieve('a')).toBe(1)
    expect(await store.retrieve('x')).toBe(9)
    expect((await plugin.loadData()).nested).toEqual({ b: 2, c: 3 })
    await store.delete('a')
    expect(await store.retrieve('a')).toBeUndefined()
  })

  test('Metrics.count increments and persists', async () => {
    const plugin = makePluginWithData({}) as any
    plugin.store = new Store(plugin)
    const metrics = new Metrics(plugin)
    // Wait for async loadCounts to settle
    await new Promise((r) => setImmediate(r))
    await metrics.count('foo')
    await metrics.count('bar')
    expect(metrics.get('foo')).toBe(1)
    expect(metrics.get('bar')).toBe(1)
    expect((await plugin.loadData()).counts).toEqual({ foo: 1, bar: 1 })
  })
})
