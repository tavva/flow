<script lang="ts">
	import { tick, onMount } from 'svelte'
	import { Component } from 'obsidian'
	import type { DataviewApi, STask, SMarkdownPage } from 'obsidian-dataview'

	import store from 'svelteStore.js'
	import FlowPlugin from 'main.js'
	import { isPlanningMode, addTaskClickListeners } from 'planning.js'

	let plugin: FlowPlugin
	store.plugin.subscribe((p: FlowPlugin) => (plugin = p))

	export let sphere: string
	export let projects: SMarkdownPage[] = []

	let sphereCapitalised: string = ''

	let projectsWithNextActions: SMarkdownPage[] = []
	let projectsWithNextActionsBelowPriorityCutoff: SMarkdownPage[] = []
	let projectsWithNextActionsAbovePriorityCutoff: SMarkdownPage[] = []
	let projectsNeedingNextActions: SMarkdownPage[] = []

	let shadowIsPlanningMode: boolean = false

	let priorityCutoff: number = 3

	export let nonProjectNextActions: DataviewApi.TaskResult = []

	$: if (sphere) {
		sphereCapitalised = sphere.charAt(0).toUpperCase() + sphere.slice(1)
	}

	$: {
		const leaves = document.querySelectorAll(
			'div.workspace-leaf-content[data-type="sphere-view"] div.view-content',
		)
		if (shadowIsPlanningMode) {
			leaves.forEach((leaf: Element) => {
				leaf.addClass('flow-sphere-in-planning-mode')
			})
		} else {
			leaves.forEach((leaf: Element) => {
				leaf.removeClass('flow-sphere-in-planning-mode')
			})
		}
	}

	onMount(() => {
		const unsubscribe = isPlanningMode.subscribe((value) => {
			shadowIsPlanningMode = value
		})

		return () => unsubscribe()
	})

	async function renderTaskList(container: HTMLElement, tasks: STask[]) {
		if (container && tasks) {
			try {
				const component = new Component()
				await plugin.dv.taskList(tasks, false, container, component)
				component.load()
			} catch (error) {
				console.error('Error rendering task list:', error)
			}
		}

		setTimeout(() => {
			// Wait for the taskList to hydrate before running our modifications
			addTaskTextToElements(tasks, container)
			addPlannedAttributeToTasks(container)
			addTaskClickListeners(plugin, container)
		}, 10)
	}

	function addTaskTextToElements(
		taskQueryResult: STask[],
		container: HTMLElement,
	) {
		const elementsInOrder = container.querySelectorAll('li')
		const rawTasks: Array<STask> = Array.from(taskQueryResult)

		const seen = new Set<number>()
		const tasks: STask[] = []

		// The task query result doesn't include completed items, but the
		// children of an uncompleted item do. Therefore, we need to traverse
		// the tree to get all tasks
		function traverse(tasksToProcess: STask[]) {
			for (const task of tasksToProcess) {
				if (!seen.has(task.line)) {
					seen.add(task.line)
					tasks.push(task)
					if (task.children && task.children.length > 0) {
						traverse(task.children)
					}
				}
			}
		}

		traverse(rawTasks)

		let elementIndex: number = 0

		tasks.forEach((task: STask) => {
			const element = elementsInOrder[elementIndex]
			if (element) {
				element.setAttribute('data-task-text', task.text)
			}

			elementIndex++
		})
	}

	function addPlannedAttributeToTasks(container: HTMLElement) {
		container
			.querySelectorAll('.task-list-item')
			.forEach((taskListItem) => {
				const links = taskListItem.querySelectorAll('a')

				links.forEach(function (link) {
					if (link.getAttribute('href') === '#flow-planned') {
						taskListItem.addClass('planned-item')
					}
				})
			})
	}

	function generateUniqueProjectId(path: string): string {
		return path.replace(/[^\w-]+/g, '-')
	}

	$: {
		if (projects.length > 0) {
			projectsWithNextActions = projects.filter(
				(project) => project.nextActions.length > 0,
			)
			projectsNeedingNextActions = projects.filter(
				(project) => project.nextActions.length === 0,
			)
		}
	}

	$: {
		if (projectsWithNextActions.length > 0) {
			if (priorityCutoff === 10) {
				projectsWithNextActionsBelowPriorityCutoff =
					projectsWithNextActions
				projectsWithNextActionsAbovePriorityCutoff = []
			} else {
				projectsWithNextActionsBelowPriorityCutoff =
					projectsWithNextActions.filter(
						(project) => project.priority <= priorityCutoff,
					)
				projectsWithNextActionsAbovePriorityCutoff =
					projectsWithNextActions.filter(
						(project) => project.priority > priorityCutoff,
					)
			}
		}
	}

	$: updateProjectTaskLists(projectsWithNextActionsBelowPriorityCutoff)
	$: updateNonProjectTaskList(nonProjectNextActions)

	function updateProjectTaskLists(projects: SMarkdownPage[]) {
		if (plugin && projects.length > 0) {
			tick().then(() => {
				projects.forEach((project) => {
					const projectId = `task-list-${sphere}-${generateUniqueProjectId(project.file.path)}`
					const container = document.getElementById(projectId)
					if (container) {
						container.empty()
						renderTaskList(container, project.nextActions)
					}
				})
			})
		}
	}

	function updateNonProjectTaskList(tasks: DataviewApi.TaskResult) {
		if (plugin && tasks.length > 0) {
			tick().then(() => {
				const container = document.getElementById(
					`task-list-non-project-${sphere}`,
				)
				if (container) {
					container.empty()
					renderTaskList(container, tasks)
				}
			})
		}
	}

	function showAllProjects() {
		priorityCutoff = 10
	}
</script>

<div class="flow-project">
	<h1>{sphereCapitalised}</h1>
	<div>
		{#if projectsNeedingNextActions && projectsNeedingNextActions.length > 0}
			<h2>You have projects that need next actions</h2>
			<ul>
				{#each projectsNeedingNextActions as project}
					<li>
						<a href={project.link} data-path={project.file.path}
							>{project.file.name}</a
						>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
	<div id="flow-task-lists">
		<div class="flow-header-flex">
			<h2>Projects</h2>

			{#if projectsWithNextActions.length > 5}
				<div id="priority-range">
					<label for="priority-cutoff">Priority cutoff</label>
					<input
						bind:value={priorityCutoff}
						type="range"
						min="1"
						max="10"
						step="1"
					/>
					<span id="priority-cutoff"
						>{priorityCutoff === 10 ? 'all' : priorityCutoff}</span
					>
				</div>
			{/if}
		</div>

		{#if projectsWithNextActions && projectsWithNextActions.length > 0}
			<ul>
				{#each projectsWithNextActions as project}
					{#if project.priority <= priorityCutoff}
						<li
							class:flow-no-actionables={project.hasActionables ===
								false}
						>
							{project.priority}.
							<a href={project.link} data-path={project.file.path}
								>{project.file.name}</a
							>
							<div
								id={`task-list-${sphere}-${generateUniqueProjectId(project.file.path)}`}
							></div>
						</li>
					{/if}
				{/each}
				{#if projectsWithNextActionsAbovePriorityCutoff.length > 0}
					<p>
						{projectsWithNextActionsAbovePriorityCutoff.length}
						more project{#if projectsWithNextActionsAbovePriorityCutoff.length > 1}s{/if}
						above priority cutoff {priorityCutoff}
						<button on:click={showAllProjects}
							>Show all projects</button
						>
					</p>
				{/if}
			</ul>
		{:else}
			<p>No projects found</p>
		{/if}
	</div>
	<div>
		<h2>Non-project next actions</h2>
		<div id="task-list-non-project-{sphere}">
			No non-project next actions found
		</div>
	</div>
</div>
