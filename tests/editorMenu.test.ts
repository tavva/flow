/** @jest-environment node */

// Mock Notice to avoid UI
jest.mock('obsidian', () => ({ Notice: class { constructor(_msg?: string) {} } }), { virtual: true })
// Mock planning import BEFORE importing the module under test
jest.mock('../src/views/planning.js', () => ({ openPlanningView: jest.fn() }))

const { createEditorMenu } = require('../src/editorMenu.js')

function makeMenu() {
  const items: any[] = []
  return {
    addItem: (cb: (item: any) => void) => {
      const subItems: any[] = []
      const subMenu = { addItem: (scb: any) => { const si: any = { setTitle: jest.fn().mockReturnThis(), onClick: (fn: any) => { (si as any)._onClick = fn } }; scb(si); subItems.push(si) }, }
      const item: any = {
        setTitle: jest.fn().mockReturnThis(),
        setSubmenu: jest.fn().mockReturnValue(subMenu),
      }
      cb(item)
      items.push({ item, subItems, subMenu })
    },
    items,
  }
}

describe('editorMenu', () => {
  test('adds Flow submenu with actions that call vault APIs', async () => {
    const menu = makeMenu() as any
    const append = jest.fn()
    const files: Record<string,string> = {}
    const plugin: any = {
      app: { vault: {
        append,
        create: async (p: string, content: string) => { files[p] = content },
        getAbstractFileByPath: (p: string) => {
          if (p === 'Inbox') return { path: 'Inbox' }
          if (files[p] !== undefined) return { path: p }
          return null
        },
      }, commands: { executeCommandById: jest.fn() } },
      stateManager: { startProcessing: jest.fn() },
    }
    plugin.settings = { inboxFilesFolderPath: 'Inbox' }
    const editor: any = {
      getCursor: () => ({ line: 0 }),
      getLine: () => 'Hello world',
      setLine: jest.fn(),
    }

    // Mock planning view import for this module too
    jest.mock('../src/views/planning.js', () => ({ openPlanningView: jest.fn() }))

    createEditorMenu(menu, editor, plugin)
    // We expect first addItem creates Flow group; its submenu has multiple entries
    expect(menu.items.length).toBeGreaterThan(0)
    const sub = menu.items[0]
    expect(sub.subItems.length).toBeGreaterThanOrEqual(4)

    // Execute the first submenu callback (send line back to inbox)
    const sendBack = sub.subItems[0]
    await sendBack._onClick?.()
    expect(append).toHaveBeenCalled()
  })
})
