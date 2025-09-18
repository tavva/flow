/** @jest-environment node */

jest.mock(
  'obsidian',
  () => ({
    Notice: jest.fn().mockImplementation((_message?: string) => {
    }),
  }),
  { virtual: true },
)

jest.mock('../src/utils.js', () => ({
  ...jest.requireActual('../src/utils.js'),
  getOrCreateInboxFile: jest.fn(),
}))

jest.mock('../src/views/planning.js', () => ({ openPlanningView: jest.fn() }))

const { Notice } = require('obsidian')
const { getOrCreateInboxFile } = require('../src/utils.js')
const { openPlanningView } = require('../src/views/planning.js')
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
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getOrCreateInboxFile as jest.Mock).mockResolvedValue({ path: 'Inbox/Flow generated inbox.md' })
  })

  test('send line to inbox appends text via vault helper', async () => {
    const menu = makeMenu() as any
    const append = jest.fn()
    const plugin: any = {
      app: { vault: { append } },
      stateManager: { startProcessing: jest.fn() },
      settings: { inboxFilesFolderPath: 'Inbox' },
    }
    const editor: any = {
      getCursor: () => ({ line: 0 }),
      getLine: () => 'Hello world',
      setLine: jest.fn(),
    }

    createEditorMenu(menu, editor, plugin)
    const sendBack = menu.items[0].subItems[0]
    await sendBack._onClick?.()

    expect(getOrCreateInboxFile).toHaveBeenCalledWith(plugin)
    expect(append).toHaveBeenCalledWith({ path: 'Inbox/Flow generated inbox.md' }, 'Hello world\n')
  })

  test('toggle planning guard rails non-task lines and toggles tag state', async () => {
    const menu = makeMenu() as any
    let currentLine = 'Plain text'
    const editor: any = {
      getCursor: () => ({ line: 0 }),
      getLine: jest.fn(() => currentLine),
      setLine: jest.fn((_line: number, value: string) => {
        currentLine = value
      }),
    }
    const plugin: any = {
      app: { vault: { append: jest.fn() } },
      stateManager: { startProcessing: jest.fn() },
      settings: { inboxFilesFolderPath: 'Inbox' },
    }

    createEditorMenu(menu, editor, plugin)
    const toggleItem = menu.items[0].subItems[1]

    await toggleItem._onClick?.()
    expect((Notice as jest.Mock).mock.calls[0][0]).toBe('Only tasks can be planned.')
    expect(editor.setLine).not.toHaveBeenCalled()

    currentLine = '- [ ] Task'
    await toggleItem._onClick?.()
    expect(editor.setLine).toHaveBeenCalledWith(0, '- [ ] Task #flow-planned')

    currentLine = '- [ ] Task #flow-planned'
    await toggleItem._onClick?.()
    expect(editor.setLine).toHaveBeenLastCalledWith(0, '- [ ] Task')
  })

  test('start processing and planning entries call plugin APIs', async () => {
    const menu = makeMenu() as any
    const plugin: any = {
      app: { vault: { append: jest.fn() } },
      stateManager: { startProcessing: jest.fn() },
      settings: { inboxFilesFolderPath: 'Inbox' },
    }
    const editor: any = {
      getCursor: () => ({ line: 0 }),
      getLine: () => '- [ ] Task',
      setLine: jest.fn(),
    }

    createEditorMenu(menu, editor, plugin)
    const [, , startProcessingItem, startPlanningItem] = menu.items[0].subItems

    await startProcessingItem._onClick?.()
    expect(plugin.stateManager.startProcessing).toHaveBeenCalled()

    await startPlanningItem._onClick?.()
    expect(openPlanningView).toHaveBeenCalledWith(plugin)
  })
})
