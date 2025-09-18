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
  beforeEach(() => {
    jest.clearAllMocks()
  })

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

  test('deleteOldTasks skips work when automation disabled or timestamp is recent', async () => {
    const { plugin } = makePluginForTasks({}, [])
    const tasks = new Tasks(plugin as any)
    plugin.settings.automaticallyDeleteOldTasks = false
    await tasks.deleteOldTasks()
    expect(plugin.store.retrieve).not.toHaveBeenCalled()

    plugin.settings.automaticallyDeleteOldTasks = true
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    plugin.store.retrieve.mockResolvedValue(Date.now())

    await tasks.deleteOldTasks()
    expect(plugin.store.store).not.toHaveBeenCalled()
  })

  test('deleteOldTasks unmarks unfinished tasks, stores payload, and respects filters', async () => {
    const { plugin } = makePluginForTasks({}, [])
    const tasks = new Tasks(plugin as any)
    plugin.settings.automaticallyDeleteOldTasks = true
    jest.setSystemTime(new Date('2024-01-05T10:00:00Z'))
    plugin.store.retrieve.mockResolvedValue(Date.now() - 3 * 24 * 60 * 60 * 1000)

    const incompleteTask = { text: 'Do work', path: 'file.md', line: 1 }
    const completedTask = { text: 'Done', completed: true }
    const filtered = [incompleteTask, completedTask]
    const where = jest.fn((predicate: any) => filtered.filter(predicate))
    jest.spyOn(tasks as any, 'getPlannedTasks').mockReturnValue({ where })
    const unmark = jest
      .spyOn(tasks as any, 'unmarkTaskAsPlannedNextAction')
      .mockResolvedValue(undefined)

    await tasks.deleteOldTasks()

    expect(where).toHaveBeenCalled()
    expect(unmark).toHaveBeenCalledTimes(1)
    expect(unmark).toHaveBeenCalledWith(incompleteTask)
    expect(plugin.store.store).toHaveBeenCalledWith({ 'old-tasks': [incompleteTask] })
  })

  test('deleteOldTasks leaves store untouched when no eligible tasks remain', async () => {
    const { plugin } = makePluginForTasks({}, [])
    const tasks = new Tasks(plugin as any)
    plugin.settings.automaticallyDeleteOldTasks = true
    jest.setSystemTime(new Date('2024-02-01T07:00:00Z'))
    plugin.store.retrieve.mockResolvedValue(0)
    jest
      .spyOn(tasks as any, 'getPlannedTasks')
      .mockReturnValue({ where: () => [] })

    await tasks.deleteOldTasks()

    expect(plugin.store.store).not.toHaveBeenCalled()
  })

  test('deleteSavedOldTasks clears persisted entries and getOldTasks normalizes undefined', async () => {
    const { plugin } = makePluginForTasks({}, [])
    const tasks = new Tasks(plugin as any)
    plugin.store.retrieve.mockResolvedValueOnce(undefined)
    expect(await tasks.getOldTasks()).toEqual([])

    await tasks.deleteSavedOldTasks()
    expect(plugin.store.delete).toHaveBeenCalledWith('old-tasks')
  })

  test('resolveLineIndex clamps indices and favors trimmed original matches', () => {
    const { plugin } = makePluginForTasks({}, [])
    const tasks = new Tasks(plugin as any)
    const resolver = (tasks as any).resolveLineIndex.bind(tasks)
    const lines = ['alpha', 'beta  ', 'gamma']

    expect(resolver(lines, -5)).toBe(0)
    expect(resolver(lines, 10)).toBe(2)
    expect(resolver(lines, 2, 'beta')).toBe(1)

    const moved = ['beta', 'alpha', 'gamma']
    expect(resolver(moved, 3, 'beta  ')).toBe(0)

    expect(() => resolver([], 1)).toThrow('Cannot update empty file')
  })
})
