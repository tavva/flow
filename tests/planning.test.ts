/** @jest-environment node */

// Mock svelte store to avoid ESM import issues
jest.mock('svelte/store', () => {
  let value = false
  return {
    writable: (v: boolean) => {
      value = v
      return {
        subscribe: (fn: (v: boolean) => void) => { fn(value); return () => {} },
        set: (nv: boolean) => { value = nv },
        update: (fn: (v: boolean) => boolean) => { value = fn(value) },
      }
    },
    get: () => value,
  }
}, { virtual: true })

import { get } from 'svelte/store'

// Mock openPlanningView to observe calls
jest.mock('../src/views/planning.js', () => ({ openPlanningView: jest.fn() }))

// Minimal FlowPlugin stub for typing
jest.mock('../src/main.js', () => ({ __esModule: true, default: class {} }), { virtual: true })

import { isPlanningMode, togglePlanningMode, createHandleTaskClick } from '../src/planning.js'
import { openPlanningView } from '../src/views/planning.js'

describe('planning helpers', () => {
  test('togglePlanningMode toggles store and opens planning view on enable', () => {
    const plugin: any = {}
    expect(get(isPlanningMode)).toBe(false)
    togglePlanningMode(plugin)
    expect(get(isPlanningMode)).toBe(true)
    expect(openPlanningView).toHaveBeenCalledTimes(1)

    togglePlanningMode(plugin)
    expect(get(isPlanningMode)).toBe(false)
  })

  test('createHandleTaskClick marks task when in planning mode', async () => {
    const mockTask = { text: 'Do X', path: 'A.md', line: 3, symbol: '-', status: ' ' }
    const plugin: any = {
      tasks: {
        getTask: jest.fn().mockReturnValue(mockTask),
        markTaskAsPlannedNextAction: jest.fn(),
      }
    }
    plugin.settings = { nextActionsFilePath: 'Next actions.md' }

    togglePlanningMode(plugin) // enter planning mode
    const handler = createHandleTaskClick(plugin)

    const stopPropagation = jest.fn()
    const preventDefault = jest.fn()
    // Provide a minimal object that will fail the DOM traversal and fall back to nextActionsFilePath
    const li: any = {
      getAttribute: (_: string) => mockTask.text,
      closest: (sel: string) => {
        if (sel.includes('dataview.task-list-item')) return li
        throw new Error('no dom')
      },
    }

    await handler({ target: li, preventDefault, stopPropagation })
    expect(preventDefault).toHaveBeenCalled()
    expect(stopPropagation).toHaveBeenCalled()
    expect(plugin.tasks.markTaskAsPlannedNextAction).toHaveBeenCalledWith(mockTask)

    // leave planning mode
    togglePlanningMode(plugin)
  })
})
