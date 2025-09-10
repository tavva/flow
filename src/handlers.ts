import { App, TFile } from 'obsidian'

import FlowPlugin from './main.js'

import {
    addToNextActions,
    addToSomeday,
    addToProjectNextActions,
    addToProjectReference,
    addToPersonDiscussNext,
    addToPersonReference,
    getFilesWithTagPrefix,
    createNewProjectFile,
    parseProjectTemplate,
    createNewPersonFile,
    parsePersonTemplate,
} from './utils.js'
import { FileSelectorModal } from './modals/fileSelectorModal.js'
import { NewProjectModal } from './modals/newProjectModal.js'
import { SphereSelectorModal } from './modals/sphereSelectorModal.js'
import { NewPersonModal } from './modals/newPersonModal.js'

import { Stage, type LineWithFile } from './processing.js'

export class Handlers {
    private app: App
    private plugin: FlowPlugin

    constructor(plugin: FlowPlugin) {
        this.plugin = plugin
        this.app = plugin.app
    }

    addToNextActions = async (text: string) => {
        new SphereSelectorModal(
            this.app,
            this.plugin.settings.spheres,
            async (selectedSpheres: string[]) => {
                await addToNextActions(this.plugin, text, selectedSpheres)
                await this.removeProcessedItem()
                this.plugin.metrics.count('action-created')
            },
        ).open()
    }
    // Create a new person note from processing flow
    newPerson = async (text: string) => {
        new NewPersonModal(
            this.plugin,
            text,
            async (personName: string, description: string) => {
                const personFile = await createNewPersonFile(
                    this.plugin,
                    personName,
                )
                await this.app.vault.process(personFile, (content) =>
                    parsePersonTemplate({ content, description }),
                )
                await this.removeProcessedItem()
                this.plugin.metrics.count('new-person-created')
            },
        ).open()
    }

    addToProjectNextActions = async (text: string) => {
        const projectFiles = getFilesWithTagPrefix(this.plugin, 'project')

        new FileSelectorModal(
            this.app,
            projectFiles,
            async (file: TFile) => {
                await addToProjectNextActions(this.plugin, file, text)
                await this.removeProcessedItem()
                this.plugin.metrics.count('project-action-created')
            },
            'Select a project',
            'Search projects...',
        ).open()
    }

    addToPersonDiscussNext = async (text: string) => {
        const personFiles = getFilesWithTagPrefix(this.plugin, 'person')

        new FileSelectorModal(
            this.app,
            personFiles,
            async (file: TFile) => {
                await addToPersonDiscussNext(this.plugin, file, text)
                await this.removeProcessedItem()
                this.plugin.metrics.count('person-action-created')
            },
            'Select a person',
            'Search for a person',
        ).open()
    }

    addToProjectReference = async (text: string) => {
        const projectFiles = getFilesWithTagPrefix(this.plugin, 'project')

        new FileSelectorModal(
            this.app,
            projectFiles,
            async (file: TFile) => {
                await addToProjectReference(this.plugin, file, text)
                await this.removeProcessedItem()
                this.plugin.metrics.count('project-reference-created')
            },
            'Select a project',
            'Search projects...',
        ).open()
    }

    addToPersonReference = async (text: string) => {
        const projectFiles = getFilesWithTagPrefix(this.plugin, 'person')

        new FileSelectorModal(
            this.app,
            projectFiles,
            async (file: TFile) => {
                await addToPersonReference(this.plugin, file, text)
                await this.removeProcessedItem()
                this.plugin.metrics.count('person-reference-created')
            },
            'Select a person',
            'Search for a person',
        ).open()
    }

    addToSomeday = async (text: string) => {
        new SphereSelectorModal(
            this.app,
            this.plugin.settings.spheres,
            async (selectedSpheres: string[]) => {
                await addToSomeday(this.plugin, text, selectedSpheres)
                await this.removeProcessedItem()
                this.plugin.metrics.count('add-to-someday')
            },
        ).open()
    }

    newProject = async (text: string) => {
        new NewProjectModal(
            this.plugin,
            text,
            async (
                projectName: string,
                description: string,
                spheres: Set<string>,
                priority: number,
            ) => {
                const projectFile = await createNewProjectFile(
                    this.plugin,
                    projectName,
                )

                await this.app.vault.process(projectFile, (content) => {
                    const sphereText = Array.from(spheres)
                        .map((s) => `project/${s}`)
                        .join(' ')

                    const parsedContent = parseProjectTemplate({
                        content: content,
                        priority: priority,
                        sphere: sphereText,
                        description: description,
                    })
                    return parsedContent
                })

                await this.removeProcessedItem()
                this.plugin.metrics.count('new-project-created')
            },
        ).open()
    }

    trash = async () => {
        await this.removeProcessedItem()
        this.plugin.metrics.count('item-trashed')
    }

    private async removeProcessedItem() {
        if (this.plugin.stateManager.currentStage === Stage.File) {
            const processedLine =
                this.plugin.stateManager.linesToProcess.shift()
            if (this.plugin.stateManager.linesToProcess.length === 0) {
                this.plugin.stateManager.currentStage = null
            }
            if (processedLine) {
                await this.updateInboxFile(processedLine)
            }
            this.plugin.metrics.count('line-processed')
            this.plugin.stateManager.startProcessing()
        } else if (this.plugin.stateManager.currentStage === Stage.Folder) {
            const processedFile =
                this.plugin.stateManager.filesToProcess.shift()
            if (this.plugin.stateManager.filesToProcess.length === 0) {
                this.plugin.stateManager.currentStage = null
            }
            if (processedFile) {
                await this.deleteFolderFile(processedFile)
            }
            this.plugin.metrics.count('file-processed')
            this.plugin.stateManager.startProcessing()
        }
    }

    private async updateInboxFile(processedLine: LineWithFile) {
        const { file, line } = processedLine

        if (this.plugin.stateManager.inboxFilesFolder) {
            await this.removeEmptyLinesFromFile(file)

            this.plugin.app.vault.process(file, (currentContent) => {
                const currentLines = currentContent.split('\n')
                const firstLine = currentLines[0]
                if (firstLine && firstLine.trim() === line.trim()) {
                    const updatedContent = currentLines.slice(1).join('\n')
                    return updatedContent
                } else {
                    console.log('processedLine:', processedLine)
                    console.log('currentLines[0]:', currentLines[0])
                    console.error(
                        'Mismatch in the processed line and the current first line',
                    )
                    return currentContent
                }
            })
        }
    }

    private async deleteFolderFile(file: TFile) {
        await this.app.vault.delete(file)
    }

    private async removeEmptyLinesFromFile(file: TFile): Promise<void> {
        this.plugin.app.vault.process(file, (content) => {
            return content
                .split('\n')
                .filter((line) => line.trim() !== '')
                .join('\n')
        })
    }
}
