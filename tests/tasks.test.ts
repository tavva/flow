/** @jest-environment node */

// Minimal mocks
jest.mock('obsidian', () => ({
  TFile: class { constructor(public path: string) {} },
  debounce: (fn: any) => fn,
}), { virtual: true })

jest.useFakeTimers()

import { Tasks } from '../src/tasks.js'
import { TFile } from 'obsidian'

function makePluginForTasks(initialFiles: Record<string,string>, dvTasks: any[]) {
  const files = { ...initialFiles }
  const plugin: any = {
    dv: {
      pages: (_q?: any) => ({
        file: { tasks: {
          where: (pred: (t: any) => boolean) => dvTasks.filter(pred),
        }},
      }),
    },
    app: {
      vault: {
        getAbstractFileByPath: (p: string) => new (TFile as any)(p),
        process: async (_file: any, fn: (content: string) => string) => {
          const newContent = fn(files[_file.path] ?? '')
          files[_file.path] = newContent
        },
        create: async (p: string, content: string) => { files[p] = content },
        modify: async (_file: any, content: string) => { files[_file.path] = content },
      },
    },
    events: { on: jest.fn(), trigger: jest.fn() },
    store: { store: jest.fn(), retrieve: jest.fn(), delete: jest.fn() },
    settings: { exportPlannedTasks: false, automaticallyDeleteOldTasks: false },
  }
  return { plugin, files }
}

describe('Tasks', () => {
  test('markTaskAsPlannedNextAction and unmark reverse the change', async () => {
    const content = ['- [ ] Do X', '- [ ] Other'].join('\n')
    const path = 'A.md'
    const task = { text: 'Do X', path, line: 1, symbol: '-', status: ' ', tags: [] }
    const { plugin, files } = makePluginForTasks({ [path]: content }, [task])
    const tasks = new Tasks(plugin as any)

    await tasks.markTaskAsPlannedNextAction(task as any)
    jest.runAllTimers()
    expect(files[path]).toContain('- [ ] Do X #flow-planned')

    await tasks.unmarkTaskAsPlannedNextAction({ ...task, text: 'Do X #flow-planned' } as any)
    jest.runAllTimers()
    expect(files[path]).toContain('- [ ] Do X\n')
  })

  test('exportPlannedTasks writes JSON array when enabled', async () => {
    const path = 'A.md'
    const task = { text: 'Do X #flow-planned', path, line: 1, symbol: '-', status: ' ', tags: ['#flow-planned'] }
    const { plugin, files } = makePluginForTasks({ [path]: '- [ ] Do X #flow-planned' }, [task])
    plugin.settings.exportPlannedTasks = true
    const tasks = new Tasks(plugin as any)

    // trigger export via event listener indirectly
    await (tasks as any).exportPlannedTasks()
    expect(files['flow-planned-actions-export.md']).toBe('["Do X"]')
  })
})
