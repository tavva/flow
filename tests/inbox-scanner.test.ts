import { InboxScanner, InboxItem } from '../src/inbox-scanner';
import { InboxProcessingModal } from '../src/inbox-modal';
import { GTDProcessingResult, PluginSettings } from '../src/types';

jest.mock('obsidian');
import { App, TFile, Vault } from 'obsidian';

describe('Inbox deletion handling', () => {
        let app: App;
        let vault: Vault;
        let settings: PluginSettings;
        let scanner: InboxScanner;
        let inboxFile: TFile;
        let fileContents: Record<string, string>;

        const baseSettings: PluginSettings = {
                anthropicApiKey: 'test-key',
                defaultPriority: 2,
                defaultStatus: 'live',
                inboxFilesFolderPath: 'Flow Inbox Files',
                inboxFolderPath: 'Flow Inbox Folder',
                nextActionsFilePath: 'Next actions.md',
                somedayFilePath: 'Someday.md',
                projectsFolderPath: 'Projects',
                spheres: ['personal', 'work']
        };

        beforeAll(() => {
        const createMockElement = () => {
                const element: any = {
                        addClass: jest.fn(),
                        appendChild: jest.fn(),
                        classList: {
                                add: jest.fn(),
                                remove: jest.fn(),
                                toggle: jest.fn()
                        },
                        createDiv: jest.fn(() => createMockElement()),
                        createEl: jest.fn(() => createMockElement()),
                        empty: jest.fn(),
                        setAttr: jest.fn(),
                        setText: jest.fn(),
                        style: {}
                };

                return element;
        };

        (global as any).document = {
                createElement: jest.fn(() => createMockElement())
        };
        });

        beforeEach(() => {
                app = new App();
                vault = app.vault as unknown as Vault;
                settings = { ...baseSettings };
                scanner = new InboxScanner(app as unknown as App, settings);

                inboxFile = new TFile('Flow Inbox Files/inbox.md', 'inbox');
                fileContents = {
                        [inboxFile.path]: ['Line one', 'Line two', 'Line three', 'Line four'].join('\n')
                };

                (vault.read as jest.Mock).mockImplementation((file: TFile) => {
                        return Promise.resolve(fileContents[file.path] ?? '');
                });

                (vault.modify as jest.Mock).mockImplementation((file: TFile, newContent: string) => {
                        fileContents[file.path] = newContent;
                        return Promise.resolve();
                });
        });

        afterEach(() => {
                jest.clearAllMocks();
        });

        it('removes multiple lines from the same file even when original positions change', async () => {
                const firstItem: InboxItem = {
                        type: 'line',
                        content: 'Line two',
                        sourceFile: inboxFile,
                        lineNumber: 2
                };

                const secondItem: InboxItem = {
                        type: 'line',
                        content: 'Line four',
                        sourceFile: inboxFile,
                        lineNumber: 4
                };

                await scanner.deleteInboxItem(firstItem);
                expect(fileContents[inboxFile.path]).toBe(['Line one', 'Line three', 'Line four'].join('\n'));

                await scanner.deleteInboxItem(secondItem);
                expect(fileContents[inboxFile.path]).toBe(['Line one', 'Line three'].join('\n'));
        });

        it('tracks per-file deletions when saving multiple processed inbox items', async () => {
                const modal = new InboxProcessingModal(app as unknown as App, settings, false);

                (modal as any).renderEditableItemsList = jest.fn();

                const deleteMock = jest.fn().mockResolvedValue(undefined);

                (modal as any).inboxScanner = {
                        deleteInboxItem: deleteMock
                } as Pick<InboxScanner, 'deleteInboxItem'>;

                (modal as any).writer = {};

                const baseResult: GTDProcessingResult = {
                        isActionable: true,
                        category: 'next-action',
                        nextAction: 'Line content',
                        reasoning: 'test',
                        recommendedAction: 'trash',
                        recommendedActionReasoning: 'test'
                };

                const processedItems = [
                        {
                                original: 'Line two',
                                result: baseResult,
                                selectedAction: 'trash',
                                selectedSpheres: [],
                                inboxItem: {
                                        type: 'line',
                                        content: 'Line two',
                                        sourceFile: inboxFile,
                                        lineNumber: 2
                                }
                        },
                        {
                                original: 'Line four',
                                result: baseResult,
                                selectedAction: 'trash',
                                selectedSpheres: [],
                                inboxItem: {
                                        type: 'line',
                                        content: 'Line four',
                                        sourceFile: inboxFile,
                                        lineNumber: 4
                                }
                        }
                ] as any;

                // Convert processedItems to editableItems format for the new workflow
                const editableItems = processedItems.map((item: any) => ({
                        original: item.original,
                        inboxItem: item.inboxItem,
                        isAIProcessed: true,
                        result: item.result,
                        selectedProject: item.selectedProject,
                        selectedAction: item.selectedAction,
                        selectedSpheres: item.selectedSpheres,
                        editedName: item.editedName,
                        editedProjectTitle: item.editedProjectTitle
                }));
                (modal as any).editableItems = editableItems;

                await (modal as any).saveAllItems();

                expect(deleteMock).toHaveBeenCalledTimes(2);
                expect(deleteMock).toHaveBeenNthCalledWith(
                        1,
                        expect.objectContaining({ lineNumber: 2 })
                );
                expect(deleteMock).toHaveBeenNthCalledWith(
                        2,
                        expect.objectContaining({ lineNumber: 3 })
                );
        });
});
