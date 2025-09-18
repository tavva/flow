/** @jest-environment node */

jest.mock(
  'obsidian',
  () => ({
    App: class {},
    TFile: class { constructor(public path: string) {} },
    TFolder: class { constructor(public path: string) {} },
    WorkspaceLeaf: class {},
    Notice: jest.fn(),
  }),
  { virtual: true },
)

jest.mock('../src/views/processing.js', () => ({
  PROCESSING_VIEW_TYPE: 'processing-view',
  ProcessingView: class {},
}))

const { StateManager, Stage } = require('../src/processing.js')

function createManager() {
  const plugin: any = {
    app: {
      workspace: {
        getLeavesOfType: jest.fn().mockReturnValue([]),
        getLeaf: jest.fn().mockReturnValue({ setViewState: jest.fn(), view: { getViewType: () => 'processing-view' } }),
        revealLeaf: jest.fn(),
        getActiveViewOfType: jest.fn().mockReturnValue(undefined),
      },
      vault: {
        getAbstractFileByPath: jest.fn().mockReturnValue(null),
        getMarkdownFiles: jest.fn().mockReturnValue([]),
        read: jest.fn(),
      },
    },
    settings: { inboxFilesFolderPath: 'Inbox/Files', inboxFolderPath: 'Inbox/Folders' },
  }
  const manager = new StateManager(plugin)
  return { manager, plugin }
}

describe('StateManager.startProcessing', () => {
  test('returns early when already processing', async () => {
    const { manager } = createManager()
    const updateCounts = jest.spyOn(manager as any, 'updateCounts')
    ;(manager as any).startProcessingLock = true

    await manager.startProcessing()

    expect(updateCounts).not.toHaveBeenCalled()
  })

  test('chooses file stage when inbox lines remain', async () => {
    const { manager } = createManager()
    jest.spyOn(manager as any, 'readSettingsPaths').mockImplementation(() => {})
    jest.spyOn(manager as any, 'updateCounts').mockResolvedValue(undefined)
    jest.spyOn(manager as any, 'areInboxFilesEmpty').mockResolvedValue(false)
    jest.spyOn(manager as any, 'isFolderInboxEmpty').mockResolvedValue(true)
    const processFiles = jest.spyOn(manager as any, 'processInboxFiles').mockResolvedValue(undefined)
    const processFolder = jest.spyOn(manager as any, 'processInboxFolder').mockResolvedValue(undefined)
    const complete = jest.spyOn(manager as any, 'completeProcessing').mockResolvedValue(undefined)

    await manager.startProcessing()

    expect(manager.currentStage).toBe(Stage.File)
    expect(processFiles).toHaveBeenCalled()
    expect(processFolder).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
  })

  test('processes folder stage when files queue is empty', async () => {
    const { manager } = createManager()
    jest.spyOn(manager as any, 'readSettingsPaths').mockImplementation(() => {})
    jest.spyOn(manager as any, 'updateCounts').mockResolvedValue(undefined)
    jest.spyOn(manager as any, 'areInboxFilesEmpty').mockResolvedValue(true)
    jest.spyOn(manager as any, 'isFolderInboxEmpty').mockResolvedValue(false)
    const processFolder = jest.spyOn(manager as any, 'processInboxFolder').mockResolvedValue(undefined)
    const complete = jest.spyOn(manager as any, 'completeProcessing').mockResolvedValue(undefined)

    await manager.startProcessing()

    expect(manager.currentStage).toBe(Stage.Folder)
    expect(processFolder).toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
  })

  test('marks processing complete when both inboxes empty', async () => {
    const { manager } = createManager()
    jest.spyOn(manager as any, 'readSettingsPaths').mockImplementation(() => {})
    jest.spyOn(manager as any, 'updateCounts').mockResolvedValue(undefined)
    jest.spyOn(manager as any, 'areInboxFilesEmpty').mockResolvedValue(true)
    jest.spyOn(manager as any, 'isFolderInboxEmpty').mockResolvedValue(true)
    const complete = jest.spyOn(manager as any, 'completeProcessing').mockResolvedValue(undefined)

    await manager.startProcessing()

    expect(complete).toHaveBeenCalled()
    expect(manager.currentStage).toBe(null)
  })
})

describe('StateManager view updates', () => {
  test('processInboxFiles forwards line and stage to view', async () => {
    const { manager } = createManager()
    manager.linesToProcess = [{ line: 'Line item', file: {} }]
    manager.currentStage = Stage.File

    const view = { setProps: jest.fn(), updateEmbeddedFile: jest.fn() }
    jest.spyOn(manager as any, 'updateStatus').mockResolvedValue(undefined)
    jest.spyOn(manager as any, 'setupOrGetProcessingView').mockResolvedValue(view)

    await (manager as any).processInboxFiles()

    expect(view.setProps).toHaveBeenCalledWith({
      line: 'Line item',
      noteContent: '',
      currentStage: Stage.File,
      isProcessingComplete: false,
    })
  })

  test('processInboxFolder updates embedded file and props', async () => {
    const { manager } = createManager()
    manager.filesToProcess = [{ path: 'Inbox/Folders/Task.md', name: 'Task.md' }]
    manager.currentStage = Stage.Folder

    const view = { setProps: jest.fn(), updateEmbeddedFile: jest.fn() }
    jest.spyOn(manager as any, 'updateStatus').mockResolvedValue(undefined)
    jest.spyOn(manager as any, 'setupOrGetProcessingView').mockResolvedValue(view)

    await (manager as any).processInboxFolder()

    expect(view.updateEmbeddedFile).toHaveBeenCalledWith('Inbox/Folders/Task.md')
    expect(view.setProps).toHaveBeenCalledWith({
      line: 'Task.md',
      isProcessingComplete: false,
    })
  })

  test('completeProcessing sets completion flag on view', async () => {
    const { manager } = createManager()
    const view = { setProps: jest.fn() }
    jest.spyOn(manager as any, 'updateStatus').mockResolvedValue(undefined)
    jest.spyOn(manager as any, 'setupOrGetProcessingView').mockResolvedValue(view)

    await (manager as any).completeProcessing()

    expect(view.setProps).toHaveBeenCalledWith({ isProcessingComplete: true })
  })

  test('updateCounts tallies inbox items and updates active view', async () => {
    const { manager, plugin } = createManager()
    const inboxFilesFolder = { path: 'Inbox/Files' }
    const inboxFolder = { path: 'Inbox/Folders' }
    plugin.app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
      if (path === 'Inbox/Files') return inboxFilesFolder
      if (path === 'Inbox/Folders') return inboxFolder
      return null
    })
    plugin.app.vault.getMarkdownFiles.mockReturnValue([
      { path: 'Inbox/Files/file1.md', name: 'file1.md' },
      { path: 'Inbox/Folders/file2.md', name: 'file2.md' },
    ])
    plugin.app.vault.read.mockImplementation(async (file: any) => {
      if (file.path === 'Inbox/Files/file1.md') {
        return 'Line 1\n\nLine 2'
      }
      return 'Note'
    })

    const view = { setProps: jest.fn() }
    jest
      .spyOn(manager as any, 'getProcessingViewIfActive')
      .mockResolvedValue(view)

    await manager.updateCounts()

    expect(manager.linesToProcess.map((l: any) => l.line)).toEqual(['Line 1', 'Line 2'])
    expect(manager.filesToProcess.map((f: any) => f.path)).toEqual(['Inbox/Folders/file2.md'])
    expect(view.setProps).toHaveBeenCalledWith({ lineCount: 2, fileCount: 1 })
  })
})
