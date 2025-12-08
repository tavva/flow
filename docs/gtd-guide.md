# GTD Guide

This guide explains how Flow implements David Allen's Getting Things Done methodology.

## Core Principles

GTD is built on a simple insight: your mind is for having ideas, not holding them.

When you try to remember tasks, commitments, and ideas, you waste mental energy that should go towards your actual work. GTD provides a trusted system to capture everything, so your mind can focus on execution.

## The GTD Workflow

### 1. Capture

Collect everything that has your attention. Don't organise or evaluate yet—just get it out of your head.

In Flow:

- Use the "Add to inbox" command or ribbon icon
- Capture from external tools (see [Quick Capture Methods](quick-capture.md))
- Multiple inboxes for different contexts (work, personal)

### 2. Clarify

Process each captured item:

- **Is it actionable?** If not, trash it, file it as reference, or add to someday/maybe
- **What's the next action?** Define the very next physical action required
- **Is it a project?** If it requires multiple actions, it's a project

Flow's AI assists by:

- Categorising items automatically
- Suggesting which existing project an action belongs to
- Refining vague inputs into clear, actionable items

### 3. Organise

Put items where they belong:

- **Next Actions** — Single completable actions, organised by project
- **Projects** — Multi-step outcomes with their own next actions lists
- **Waiting For** — Items you're waiting on others to complete
- **Someday/Maybe** — Future aspirations not committed to now
- **Reference** — Information to store for later

### 4. Review

Look over your system regularly to keep it trusted:

- **Daily** — Review your focus and next actions
- **Weekly** — Process all inboxes, review all projects, update stale items

### 5. Engage

Do what needs doing. With a trusted system, you can work confidently knowing nothing is falling through the cracks.

## GTD in Flow

### Spheres

Spheres are life areas: work, personal, side projects. Each sphere contains projects and actions relevant to that area.

### Projects

A project is any outcome requiring more than one action. Flow projects use YAML frontmatter:

```markdown
---
priority: 2
tags: project/work
status: live
parent-project: "[[Parent Project]]"
---

# Project Title

Project description.

## Next actions

- [ ] Specific actionable items
- [w] Items waiting on others
```

**Project statuses:**

- `live` — Active projects you're working on
- `planning` — Projects being defined
- `on-hold` — Temporarily paused
- `complete` — Finished projects

### Next Actions

A next action is the very next physical, visible activity required to move something forward.

**Quality standards:**

- Start with an action verb
- Be specific and completable in one sitting
- Include context (who, where, what specifically)
- 15-150 characters

**Good examples:**

- "Call Dr. Smith at 555-0123 to schedule cleaning"
- "Draft email to Sarah about Q4 budget concerns"
- "Review pull request #142 on flow repo"

**Bad examples:**

- "dentist" (not actionable)
- "work on website" (too vague)
- "maybe contact someone about the thing" (unclear)

### Waiting For

Items waiting on others use the `[w]` checkbox status:

```markdown
- [w] Waiting for Sarah to review design mockups
```

View all waiting-for items across your vault in the Waiting For view.

### Someday/Maybe

Future aspirations and ideas you're not committed to now. Review regularly during weekly reviews—some items will become active projects, others will be deleted.

## The Focus

Your focus is a curated list of next actions you intend to work on. It's not a complete list of everything you could do—it's what you've decided to do.

Build your focus:

1. Open a sphere view
2. Enter planning mode
3. Click actions to add them to your focus
4. Work from your focus throughout the day

## Weekly Review

The weekly review keeps your system trusted. Schedule 1-2 hours weekly to:

1. **Process** — Get all inboxes to zero
2. **Review** — Look at each project and sphere
3. **Update** — Mark complete items, add new actions, update statuses
4. **Plan** — Identify priorities for the coming week

## Further Reading

- _Getting Things Done_ by David Allen — The original methodology
- [GTD Summit](https://gettingthingsdone.com/) — David Allen's official resources
