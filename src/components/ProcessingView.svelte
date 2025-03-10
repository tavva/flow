<script lang="ts">
    import { MarkdownRenderer, Component } from 'obsidian'

    import store from '../svelteStore.js'
    import FlowPlugin from '../main.js'
    import { openPlanningView } from '../views/planning.js'

    let plugin: FlowPlugin
    store.plugin.subscribe((p: FlowPlugin) => (plugin = p))

    export let lineCount: number
    export let fileCount: number

    export let line: string
    export let isProcessingComplete: false

    export let noteContent: string = ''
    export let sourcePath: string = ''
    export let noteContainer: HTMLDivElement
    export let parentComponent: Component

    $: renderMarkdown(noteContent)

    async function renderMarkdown(content: string) {
        if (noteContainer) {
            noteContainer.empty()

            if (!content) {
                return
            }

            await MarkdownRenderer.render(
                plugin.app,
                content,
                noteContainer,
                sourcePath,
                parentComponent,
            )
        }
    }

    function addToNextActions() {
        if (line.trim() !== '') plugin.handlers.addToNextActions(line)
    }

    function addToProjectNextActions() {
        if (line.trim() !== '') plugin.handlers.addToProjectNextActions(line)
    }
    function addToProjectReference() {
        if (line.trim() !== '') plugin.handlers.addToProjectReference(line)
    }

    function addToPersonDiscussNext() {
        if (line.trim() !== '') plugin.handlers.addToPersonDiscussNext(line)
    }
    function addToPersonReference() {
        if (line.trim() !== '') plugin.handlers.addToPersonReference(line)
    }

    function newProject() {
        if (line.trim() !== '') plugin.handlers.newProject(line)
    }
    function addToSomeday() {
        if (line.trim() !== '') plugin.handlers.addToSomeday(line)
    }

    async function startPlanning() {
        await openPlanningView(plugin)
        plugin.stateManager.stopProcessing()
    }

    function isURL(line: string) {
        let url: URL

        try {
            url = new URL(line)
        } catch (_) {
            return false
        }

        return url.protocol === 'http:' || url.protocol === 'https:'
    }
</script>

{#if !isProcessingComplete}
    <div class="flow-status">
        {#if lineCount !== undefined && fileCount !== undefined}
            <p>Remaining: Lines: {lineCount} | Files: {fileCount}</p>
        {:else}
            <p>Loading...</p>
        {/if}
    </div>
{/if}

<div class="flow-processing">
    {#if isProcessingComplete}
        <div>
            <h3>Processing complete</h3>
            <p>All items have been processed.</p>
            <button on:click={startPlanning}>Plan your day?</button>
        </div>
    {:else}
        <textarea bind:value={line}></textarea>
        <p class="flow-2-minute-advice">
            Can you do this in less than 2 minutes? If so, do it now!
        </p>
        <div class="flow-processing-actions">
            <div class="flow-action-group">
                <span class="flow-action-group-title">Next action</span>
                <div class="flow-button-container">
                    <button
                        class="flow-next-action-general"
                        on:click={addToNextActions}
                        ><span class="flow-icon flow-icon-next-action-general"
                        ></span>General</button
                    >
                    <button
                        class="flow-project"
                        on:click={addToProjectNextActions}
                        ><span class="flow-icon flow-icon-project"
                        ></span>Project</button
                    >
                    <button
                        class="flow-person"
                        on:click={addToPersonDiscussNext}
                        ><span class="flow-icon flow-icon-person"></span>Person
                    </button>
                </div>
            </div>
            <div class="flow-action-group">
                <span class="flow-action-group-title">Reference</span>
                <div class="flow-button-container">
                    <button
                        class="flow-project"
                        on:click={addToProjectReference}
                        ><span class="flow-icon flow-icon-project"
                        ></span>Project</button
                    >
                    <button class="flow-person" on:click={addToPersonReference}
                        ><span class="flow-icon flow-icon-person"></span>
                        Person</button
                    >
                </div>
            </div>
            <div class="flow-action-group">
                <span class="flow-action-group-title">Other</span>
                <div class="flow-button-container">
                    <button class="flow-person" on:click={newProject}
                        ><span class="flow-icon flow-icon-person"></span>
                        New project</button
                    >
                    <button class="flow-someday" on:click={addToSomeday}
                        ><span class="flow-icon flow-icon-someday"
                        ></span>Someday</button
                    >
                    <button class="flow-trash" on:click={plugin.handlers.trash}
                        ><span class="flow-icon flow-icon-trash"
                        ></span>Delete</button
                    >
                </div>
            </div>
        </div>
        {#if lineCount > 0 || fileCount > 0}
            <div class="currently-processing">
                <h3>Currently processing:</h3>
                {#if isURL(line)}
                    <iframe title="User added URL" src={line}></iframe>
                {:else}
                    <p class="flow-processing-line">{line}</p>
                {/if}
            </div>
        {/if}
        {#if fileCount > 0}
            <div class="flow-note-container" bind:this={noteContainer}></div>
        {/if}
    {/if}
</div>
