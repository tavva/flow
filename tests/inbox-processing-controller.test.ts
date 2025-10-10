import { App, TFile } from 'obsidian';
import { InboxProcessingController } from '../src/inbox-processing-controller';
import { DEFAULT_SETTINGS, PluginSettings } from '../src/types';
import { EditableItem } from '../src/inbox-types';
import { InboxItem } from '../src/inbox-scanner';

describe('InboxProcessingController discardInboxItem', () => {
        const createController = (
                deleteInboxItem: jest.Mock,
                settings: PluginSettings = DEFAULT_SETTINGS
        ) => {
                const app = new App();

                return new InboxProcessingController(app as unknown as any, settings, {
                        processor: {} as any,
                        scanner: { scanProjects: jest.fn() } as any,
                        personScanner: { scanPersons: jest.fn() } as any,
                        writer: {} as any,
                        inboxScanner: {
                                deleteInboxItem,
                                getAllInboxItems: jest.fn()
                        } as any,
                        persistenceService: { persist: jest.fn() } as any
                });
        };

        it('adjusts deletion offsets before removing inbox line items', async () => {
                const deleteMock = jest.fn().mockResolvedValue(undefined);
                const controller = createController(deleteMock);
                const deletionOffsets = new Map<string, number>([['path/to/file.md', 2]]);
                const sourceFile = new TFile('path/to/file.md');

                const inboxItem: InboxItem = {
                        type: 'line',
                        content: 'Example',
                        sourceFile: sourceFile as unknown as any,
                        lineNumber: 5
                };

                const editableItem: EditableItem = {
                        original: 'Example',
                        inboxItem,
                        isAIProcessed: false,
                        selectedAction: 'next-actions-file',
                        selectedSpheres: []
                };

                await controller.discardInboxItem(editableItem, deletionOffsets);

                expect(deleteMock).toHaveBeenCalledTimes(1);
                expect(deleteMock).toHaveBeenCalledWith(
                        expect.objectContaining({ lineNumber: 3 })
                );
                expect(deletionOffsets.get('path/to/file.md')).toBe(3);
        });

        it('ignores items without inbox metadata', async () => {
                const deleteMock = jest.fn();
                const controller = createController(deleteMock);
                const deletionOffsets = new Map<string, number>();

                const editableItem: EditableItem = {
                        original: 'Example',
                        isAIProcessed: false,
                        selectedAction: 'next-actions-file',
                        selectedSpheres: []
                };

                await controller.discardInboxItem(editableItem, deletionOffsets);

                expect(deleteMock).not.toHaveBeenCalled();
                expect(deletionOffsets.size).toBe(0);
        });
});
