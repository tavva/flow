import { PluginSettingTab, Setting } from 'obsidian'
import FlowPlugin from '../main.js'

import { settingsDefinitions } from './definitions.js'
import { checkDependencies } from 'src/dependencies.js'

export class FlowSettingsTab extends PluginSettingTab {
    plugin: FlowPlugin

    constructor(plugin: FlowPlugin) {
        super(plugin.app, plugin)
        this.plugin = plugin
    }

    display(): void {
        const { containerEl } = this

        containerEl.empty()

        if (!checkDependencies(this.plugin)) {
            new Setting(containerEl)
                .setName('Dependencies not met')
                .setDesc(
                    'Flow requires the following plugins to be installed: Tasks, Dataview, and Templater.',
                )
                .setClass('flow-error')

            return
        }

        settingsDefinitions.appendTagToTask.render(containerEl, this.plugin)
        settingsDefinitions.spheres.render(containerEl, this.plugin)
        settingsDefinitions.hijackNewTab.render(containerEl, this.plugin)

        new Setting(containerEl).setName('Inbox folders').setHeading()

        settingsDefinitions.inboxFilesFolderPath.render(
            containerEl,
            this.plugin,
        )
        settingsDefinitions.inboxFolderPath.render(containerEl, this.plugin)

        new Setting(containerEl).setName('Your notes').setHeading()

        settingsDefinitions.nextActionsFilePath.render(containerEl, this.plugin)
        settingsDefinitions.newProjectTemplateFilePath.render(
            containerEl,
            this.plugin,
        )
        settingsDefinitions.projectsFolderPath.render(containerEl, this.plugin)
        settingsDefinitions.newPersonTemplateFilePath.render(
            containerEl,
            this.plugin,
        )
        settingsDefinitions.peopleFolderPath.render(containerEl, this.plugin)
        settingsDefinitions.somedayFilePath.render(containerEl, this.plugin)

        new Setting(containerEl).setName('Advanced').setHeading()

        settingsDefinitions.exportPlannedTasks.render(containerEl, this.plugin)
    }
}
