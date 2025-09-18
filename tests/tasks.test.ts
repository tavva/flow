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

  test('markTaskAsPlannedNextAction handles zero-based line numbers', async () => {
    const path = 'Zero.md'
    const content = '- [ ] First'
    const task = { text: 'First', path, line: 0, symbol: '-', status: ' ', tags: [] }
    const { plugin, files } = makePluginForTasks({ [path]: content }, [task])
    const tasks = new Tasks(plugin as any)

    await tasks.markTaskAsPlannedNextAction(task as any)
    jest.runAllTimers()

    expect(files[path]).toBe('- [ ] First #flow-planned')
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

  test('unmarkAllDoneTasks clears tag from completed tasks using 1-based lines', async () => {
    const path = 'Tasks.md'
    const initial = ['- [x] Completed #flow-planned', '- [ ] Planned #flow-planned'].join('\n')
    const doneTask = {
      text: 'Completed #flow-planned',
      path,
      line: 1,
      symbol: '-',
      status: 'x',
      completed: true,
      tags: ['#flow-planned'],
    }
    const plannedTask = {
      text: 'Planned #flow-planned',
      path,
      line: 2,
      symbol: '-',
      status: ' ',
      completed: false,
      tags: ['#flow-planned'],
    }
    const { plugin, files } = makePluginForTasks({ [path]: initial }, [doneTask, plannedTask])
    const tasks = new Tasks(plugin as any)

    await tasks.unmarkAllDoneTasksAsPlannedNextAction()
    jest.runAllTimers()

    expect(files[path]).toBe(['- [x] Completed', '- [ ] Planned #flow-planned'].join('\n'))
  })

  test('unmarkAllDoneTasks resolves stale indices by matching original line text', async () => {
    const path = 'Offsets.md'
    const initial = [
      '- [ ] Heading',
      '  - [x] Nested #flow-planned',
      '- [ ] Footer',
    ].join('\n')
    const doneTask = {
      text: 'Nested #flow-planned',
      path,
      line: 42,
      symbol: '  -',
      status: 'x',
      completed: true,
      tags: ['#flow-planned'],
    }
    const { plugin, files } = makePluginForTasks({ [path]: initial }, [doneTask])
    const tasks = new Tasks(plugin as any)

    await tasks.unmarkAllDoneTasksAsPlannedNextAction()
    jest.runAllTimers()

    expect(files[path]).toBe(['- [ ] Heading', '  - [x] Nested', '- [ ] Footer'].join('\n'))
  })
})
