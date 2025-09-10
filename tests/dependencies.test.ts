/** @jest-environment node */

jest.mock('obsidian', () => ({
  TFile: class {}, TFolder: class {}, TAbstractFile: class {}, Vault: {}, normalizePath: (p:string)=>p,
}), { virtual: true })

import { getMissingDependencies, checkDependencies } from '../src/dependencies.js'

describe('dependencies', () => {
  test('reports missing expected plugins', () => {
    const plugin: any = { app: { plugins: { plugins: {} } } }
    const missing = getMissingDependencies(plugin)
    expect(missing).toEqual([
      ['obsidian-tasks-plugin','Tasks'],
      ['dataview','Dataview'],
      ['templater-obsidian','Templater']
    ])
    expect(checkDependencies(plugin)).toBe(false)
  })

  test('checkDependencies true when all present', () => {
    const plugin: any = { app: { plugins: { plugins: {
      'obsidian-tasks-plugin': {},
      'dataview': {},
      'templater-obsidian': {},
    } } } }
    expect(checkDependencies(plugin)).toBe(true)
  })
})
