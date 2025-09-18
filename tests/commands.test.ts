/** @jest-environment node */

jest.mock('obsidian', () => ({ Notice: jest.fn(), Modal: class {} }), { virtual: true })
jest.mock('../src/views/planning.js', () => ({ openPlanningView: jest.fn() }))
jest.mock('../src/modals/newProjectModal.js', () => ({ NewProjectModal: class {} }))
jest.mock('../src/modals/addToInboxModal.js', () => ({ AddToInboxModal: class {} }))
jest.mock('../src/modals/addFocusAreaModal.js', () => ({ AddFocusAreaModal: class {} }))

const { resetSphereCommands } = require('../src/commands.js')

describe('resetSphereCommands', () => {
  test('removes old commands and registers lowercase replacements', async () => {
    const existing = {
      'flow:view-alpha-sphere': {},
      'flow:view-Beta-sphere': {},
      'something-else': {},
    }
    const plugin: any = {
      app: { commands: { commands: { ...existing } } },
      settings: { spheres: ['Alpha', 'Focus'] },
      addCommand: jest.fn(),
      openSphere: jest.fn(),
    }

    await resetSphereCommands(plugin)

    expect(plugin.app.commands.commands).not.toHaveProperty('flow:view-alpha-sphere')
    expect(plugin.app.commands.commands).not.toHaveProperty('flow:view-Beta-sphere')
    expect(plugin.app.commands.commands).toHaveProperty('something-else')

    expect(plugin.addCommand).toHaveBeenCalledTimes(2)
    const first = plugin.addCommand.mock.calls[0][0]
    expect(first.id).toBe('view-alpha-sphere')
    expect(first.name).toBe('View alpha sphere')
    first.callback()
    expect(plugin.openSphere).toHaveBeenCalledWith('alpha')

    const second = plugin.addCommand.mock.calls[1][0]
    expect(second.id).toBe('view-focus-sphere')
  })
})
