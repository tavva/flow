/** @jest-environment node */

// Mock obsidian to provide minimal classes used by suggesters
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
  class AbstractInputSuggest {
    constructor(_app: any, _inputEl: any) {}
  }
  return {
    TFile,
    TAbstractFile: class {},
    TFolder: class { constructor(public path: string) {} },
    AbstractInputSuggest,
  }
}, { virtual: true })

jest.mock('../src/main.js', () => ({ __esModule: true, default: class {} }), { virtual: true })

import { TFile } from 'obsidian'
import { FileSuggest } from '../src/settings/suggesters/FileSuggester.js'

describe('FileSuggest.getSuggestions', () => {
  test('matches files by substring (case-insensitive)', () => {
    const files = [
      new (TFile as any)('Notes/Bar.md'),
      new (TFile as any)('alpha/beta.md'),
      new (TFile as any)('docs/Readme.md'),
    ]

    const plugin: any = {
      app: {
        vault: {
          getMarkdownFiles: () => files,
        },
      },
    }

    const suggester = new FileSuggest(plugin, {} as any)
    const res = suggester.getSuggestions('bar')
    expect(res.map((f) => f.path)).toContain('Notes/Bar.md')
  })
})
