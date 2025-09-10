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

import { addToNextActions, addToProjectNextActions, addToProjectReference, createFoldersAndFile } from '../src/utils.js'

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
    expect(content).toMatch(/\n- \[ \] Do a thing #sphere\/personal #sphere\/work #filters\/me\n$/)
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
