/** @jest-environment node */
import * as path from 'path'

// Mock Obsidian and related modules used by utils
jest.mock('obsidian', () => {
  class TFile {
    path: string
    basename: string
    extension: string
    stat: { mtime: number }
    constructor(p: string) {
      this.path = p
      const base = p.split('/').pop() || ''
      this.basename = base.replace(/\.md$/, '')
      this.extension = 'md'
      this.stat = { mtime: 0 }
    }
  }
  return {
    TFile,
    TFolder: class { constructor(public path: string) {} },
    TAbstractFile: class {},
    Vault: { recurseChildren: (_folder: any, _cb: (f: any) => void) => {} },
    normalizePath: (p: string) => p,
  }
}, { virtual: true })

jest.mock('../src/main.js', () => ({ __esModule: true, default: class {} }), { virtual: true })
jest.mock('obsidian-dataview', () => ({
  SMarkdownPage: class {},
  STask: class {},
}), { virtual: true })

import { DateTime, Settings } from 'luxon'

import {
  addFocusAreaToNote,
  addToNextActions,
  addToProjectNextActions,
  addToProjectReference,
  createFoldersAndFile,
  listProjects,
} from '../src/utils.js'

type VaultMap = Record<string, string>

function makePlugin({ appendTagToTask = '' }: { appendTagToTask?: string } = {}) {
  const files: VaultMap = {}
  const createdFolders: string[] = []
  const existingFolders = new Set<string>()

  const plugin: any = {
    app: {
      vault: {
        getAbstractFileByPath: (p: string) => (p in files ? { path: p, basename: path.basename(p, '.md') } : null),
        create: async (p: string, content: string) => { files[p] = content; return { path: p, basename: path.basename(p, '.md') } },
        read: async (file: any) => files[file.path] ?? '',
        modify: async (file: any, content: string) => { files[file.path] = content },
        append: async (file: any, content: string) => { files[file.path] = (files[file.path] || '') + content },
        createFolder: async (folderPath: string) => { createdFolders.push(folderPath); existingFolders.add(folderPath) },
        adapter: {
          exists: async (p: string) => existingFolders.has(p),
        },
        getMarkdownFiles: () => Object.keys(files).filter((p) => p.endsWith('.md')).map((p) => ({ path: p, basename: path.basename(p, '.md'), extension: 'md', stat: { mtime: 0 } })),
      },
    },
    settings: {
      nextActionsFilePath: 'Next actions.md',
      somedayFilePath: 'Someday.md',
      appendTagToTask,
    },
  }

  return { plugin, files, createdFolders, existingFolders }
}

describe('utils task and file helpers', () => {
  test('addToNextActions creates file, appends newline and tag', async () => {
    const { plugin, files } = makePlugin({ appendTagToTask: '#filters/me' })
    await addToNextActions(plugin as any, 'Do a thing', ['personal', 'work'])
    const content = files['Next actions.md']
    expect(content).toBeDefined()
    expect(content).toBe(
      '- [ ] Do a thing #sphere/personal #sphere/work #filters/me\n',
    )
  })

  test('addToNextActions appends tasks without blank lines', async () => {
    const { plugin, files } = makePlugin({ appendTagToTask: '' })
    await addToNextActions(plugin as any, 'First task', [])
    await addToNextActions(plugin as any, 'Second task', [])

    const content = files['Next actions.md']
    expect(content.startsWith('- [ ] First task')).toBe(true)
    expect(content).toContain('- [ ] First task\n- [ ] Second task')
  })

  test('addToProjectNextActions inserts under existing section with optional tag', async () => {
    const { plugin, files } = makePlugin({ appendTagToTask: '#filters/me' })
    const projectPath = 'Projects/Alpha.md'
    // Seed project file with a Next actions section
    files[projectPath] = [
      '# Description',
      '',
      '## Next actions',
      '',
      '## Notes + resources',
      '',
    ].join('\n')

    const projectFile = { path: projectPath }
    await addToProjectNextActions(plugin as any, projectFile as any, 'Plan step 1')

    const content = files[projectPath]
    // Ensure the new task line appears below the section header and includes tag
    expect(content).toContain('## Next actions')
    expect(content).toContain('\n- [ ] Plan step 1 #filters/me\n')
  })

  test('addToProjectNextActions keeps tasks adjacent without blank separator', async () => {
    const { plugin, files } = makePlugin({ appendTagToTask: '' })
    const projectPath = 'Projects/Gamma.md'
    files[projectPath] = [
      '# Description',
      '',
      '## Next actions',
      '- [ ] Existing task',
      '',
      '## Notes + resources',
      '',
    ].join('\n')

    const projectFile = { path: projectPath }
    await addToProjectNextActions(plugin as any, projectFile as any, 'New task')

    const content = files[projectPath]
    expect(content).toContain('## Next actions\n- [ ] New task\n- [ ] Existing task')
    expect(content).not.toContain('## Next actions\n\n- [ ] New task')
  })

  test('addToProjectReference creates section if missing and does not append empty tag', async () => {
    const { plugin, files } = makePlugin({ appendTagToTask: '' })
    const projectPath = 'Projects/Beta.md'
    files[projectPath] = ['# Description', ''].join('\n')

    const projectFile = { path: projectPath }
    await addToProjectReference(plugin as any, projectFile as any, 'Reference link')

    const content = files[projectPath]
    expect(content).toContain('## Notes + resources')
    // Ensure a bullet was added and there is no trailing empty tag
    expect(content).toMatch(/## Notes \+ resources\n- Reference link\n/)
  })

  test('createFoldersAndFile ensures folder hierarchy and creates file', async () => {
    const { plugin, files, createdFolders, existingFolders } = makePlugin()
    const filePath = 'A/B/C/foo.md'
    // No folders exist initially
    expect(await plugin.app.vault.adapter.exists('A')).toBe(false)
    await createFoldersAndFile(filePath, 'hello', plugin as any)
    expect(createdFolders).toEqual(['A', 'A/B', 'A/B/C'])
    expect(existingFolders.has('A/B/C')).toBe(true)
    expect(files[filePath]).toBe('hello')
  })
})

describe('addFocusAreaToNote', () => {
  function makePlugin(initial: string) {
    let stored = initial
    const activeFile = { path: 'Daily/Note.md' }
    const setCursor = jest.fn()
    const plugin: any = {
      app: {
        workspace: {
          getActiveFile: () => activeFile,
          activeLeaf: { view: { editor: { setCursor, getCursor: () => ({ line: 0, ch: 0 }) } } },
        },
        vault: {
          read: jest.fn().mockResolvedValue(stored),
          modify: jest.fn().mockImplementation(async (_file: any, content: string) => {
            stored = content
          }),
        },
      },
    }
    return { plugin, setCursor, getContent: () => stored }
  }

  test('returns helpful errors when no file or editor is active', async () => {
    const plugin: any = {
      app: {
        workspace: {
          getActiveFile: () => null,
          activeLeaf: null,
        },
      },
    }

    const noFile = await addFocusAreaToNote(plugin, 'Energy')
    expect(noFile).toEqual({ success: false, error: 'No active file' })

    const activeFile = { path: 'Daily.md' }
    plugin.app.workspace.getActiveFile = () => activeFile
    const noEditor = await addFocusAreaToNote(plugin, 'Energy')
    expect(noEditor).toEqual({ success: false, error: 'No active editor' })
  })

  test('rejects notes without both focus area sections', async () => {
    const { plugin } = makePlugin(['# Daily', '## Focus areas'].join('\n'))
    const result = await addFocusAreaToNote(plugin, 'Energy')
    expect(result).toEqual({
      success: false,
      error: 'The note must contain both "## Focus areas" and "## Focus areas detail" sections',
    })
  })

  test('prevents adding duplicate focus areas', async () => {
    const duplicateContent = [
      '## Focus areas',
      '1. Energy',
      '',
      '## Focus areas detail',
      '### Energy',
      '',
    ].join('\n')
    const { plugin } = makePlugin(duplicateContent)
    const result = await addFocusAreaToNote(plugin, 'Energy')
    expect(result).toEqual({ success: false, error: 'Focus area "Energy" already exists' })
  })

  test('inserts numbered item, creates detail heading, and moves cursor', async () => {
    const initial = [
      '# Journal',
      '',
      '## Focus areas',
      '',
      '## Focus areas detail',
      '',
    ].join('\n')
    const { plugin, setCursor, getContent } = makePlugin(initial)

    const result = await addFocusAreaToNote(plugin, 'Energy')
    expect(result).toEqual({ success: true })
    const updated = getContent().split('\n')
    expect(updated).toEqual([
      '# Journal',
      '',
      '## Focus areas',
      '1. Energy',
      '',
      '## Focus areas detail',
      '',
      '',
      '### Energy',
      '',
    ])
    expect(setCursor).toHaveBeenCalledWith({ line: 9, ch: 0 })
  })
})

describe('listProjects', () => {
  class FakeDataArray<T> {
    constructor(private readonly items: T[]) {}

    filter(fn: (value: T) => boolean) {
      return new FakeDataArray(this.items.filter(fn))
    }

    map<U>(fn: (value: T) => U) {
      return new FakeDataArray(this.items.map(fn))
    }

    sort(selector: (value: any) => any, direction: 'asc' | 'desc') {
      const entries = this.items.map((item, index) => ({
        item,
        key: selector(item),
        index,
      }))
      entries.sort((a, b) => {
        if (a.key < b.key) return direction === 'asc' ? -1 : 1
        if (a.key > b.key) return direction === 'asc' ? 1 : -1
        return a.index - b.index
      })
      return new FakeDataArray(entries.map((entry) => entry.item))
    }

    then<TResult1 = T[], TResult2 = never>(
      onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
    ) {
      return Promise.resolve(this.items).then(onfulfilled, onrejected)
    }
  }

  const makeProject = (overrides: Partial<any>) => ({
    status: 'live',
    file: {
      path: 'Projects/Default.md',
      name: 'Default',
      tasks: [],
    },
    priority: 2,
    ...overrides,
  })

  afterEach(() => {
    ;(Settings as any).now = undefined
  })

  test('filters, annotates, and sorts projects with actionable tasks', async () => {
    const fixedNow = DateTime.fromISO('2024-02-01T09:00:00Z')
    Settings.now = () => fixedNow.toMillis()

    const actionableTask = {
      section: { subpath: 'Next actions' },
      completed: false,
      status: ' ',
      due: fixedNow.plus({ hours: 8 }),
    }
    const waitingTask = {
      section: { subpath: 'Next actions' },
      completed: false,
      status: 'w',
      due: undefined,
    }
    const farFutureTask = {
      section: { subpath: 'Next actions' },
      completed: false,
      status: ' ',
      due: fixedNow.plus({ days: 5 }),
    }

    const pages = new FakeDataArray([
      makeProject({
        file: {
          path: 'Projects/Gamma.md',
          name: 'Gamma',
          tasks: [actionableTask],
        },
        priority: 1,
      }),
      makeProject({
        file: {
          path: 'Projects/Beta.md',
          name: 'Beta',
          tasks: [farFutureTask],
        },
        priority: 1,
      }),
      makeProject({
        file: {
          path: 'Projects/Alpha.md',
          name: 'Alpha',
          tasks: [waitingTask],
        },
        priority: 2,
      }),
      makeProject({ status: 'draft', file: { path: 'Projects/Draft.md', name: 'Draft', tasks: [] } }),
      makeProject({ file: { path: 'Templates/Template.md', name: 'Template', tasks: [] } }),
    ])

    const plugin: any = {
      dv: {
        pages: jest.fn(() => pages),
        app: { vault: { getName: () => 'My Vault' } },
      },
    }

    const result = await listProjects(plugin, 'work')

    expect(plugin.dv.pages).toHaveBeenCalledWith('#project/work')
    expect(result).toHaveLength(3)

    const [first, second, third] = result
    expect(first.file.name).toBe('Gamma')
    expect(first.hasActionables).toBe(true)
    expect(first.nextActions).toEqual([actionableTask])

    expect(second.file.name).toBe('Beta')
    expect(second.hasActionables).toBe(false)
    expect(second.nextActions).toEqual([farFutureTask])

    expect(third.file.name).toBe('Alpha')
    expect(third.hasActionables).toBe(false)
    expect(third.nextActions).toEqual([waitingTask])

    expect(result.map((p: any) => p.link)).toEqual([
      'obsidian://open?vault=My%20Vault&file=Projects%2FGamma.md',
      'obsidian://open?vault=My%20Vault&file=Projects%2FBeta.md',
      'obsidian://open?vault=My%20Vault&file=Projects%2FAlpha.md',
    ])
  })
})
