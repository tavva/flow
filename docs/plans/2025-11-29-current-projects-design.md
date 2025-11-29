# Current Projects Feature Design

## Overview

Add a "current project" concept allowing multiple projects to be marked as current. Current projects appear in a compact box at the top of the focus view and get a visual indicator in sphere view.

## Data Model

**Frontmatter field:**
Projects get a new optional `current: true` field in their YAML frontmatter:

```yaml
---
creation-date: 2025-10-05 18:59
priority: 2
tags: project/personal
status: live
current: true
---
```

**Type changes:**
- Add `current?: boolean` to `FlowProject` interface in `src/types/domain.ts`
- Parse in `flow-scanner.ts` alongside existing frontmatter fields

## Focus View — Current Projects Box

**Location:** Appears below the "Focus" title, above the Pinned section (or above Project Actions if no pinned items).

**Rendering:**
- Compact box with subtle background (`var(--background-secondary)`)
- Small header text: "Current"
- List of project names in smaller font, tightly packed (reduced line-height)
- Each project name is clickable — opens the project file
- If no projects are marked current, the box doesn't render at all

**Visual example:**
```
┌─────────────────────────────┐
│ Current                     │
│ Website Redesign            │
│ Q4 Planning                 │
│ Kitchen Renovation          │
└─────────────────────────────┘
```

## Sphere View — Visual Indicator

Current projects get a small diamond indicator (◆) before their name in sphere view.

**Example:**
```
◆ Website Redesign
  - [ ] Draft homepage wireframes

  Q4 Planning
  - [ ] Review budget proposals
```

## Context Menu — Toggle Current Status

**Trigger:** Right-click on a project name in sphere view.

**Menu items:**
- If project is not current: "Mark as current"
- If project is current: "Remove from current"

**Behaviour:**
- If marking current: add `current: true` to frontmatter
- If removing: delete the `current` field entirely (don't set to `false`)
- No confirmation modal needed — easily reversible

## Files to Modify

**Type changes:**
- `src/types/domain.ts` — Add `current?: boolean` to `FlowProject`

**Parsing:**
- `src/flow-scanner.ts` — Parse `current` from frontmatter in `parseProjectFile()`

**Focus view:**
- `src/focus-view.ts` — Add `renderCurrentProjectsBox()`, call before pinned section

**Sphere view:**
- `src/sphere-view.ts` — Add visual indicator for current projects, add context menu handler

**Styling:**
- `src/styles.css` — Add styles for current projects box and indicator

**Frontmatter writing:**
- New utility or inline in sphere-view to toggle `current` field in project frontmatter

**Tests:**
- `tests/flow-scanner.test.ts` — Test parsing `current` field
- `tests/focus-view.test.ts` — Test current projects box rendering
- `tests/sphere-view.test.ts` — Test indicator and context menu
