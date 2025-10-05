We're creating a GTD coach that helps keep our projects in order, and ensures we have the next actions ready and they're quality next actions according to GTD. We have a browser only version here. We need to change it to run on our Obsidian vault which uses Flow (https://github.com/tavva/flow-release). Flow projects have a tag that begins with 'project/' in the frontmatter. Here's an example of the frontmatter of a personal project:

---
creation-date: 2025-10-05 18:59
priority: 2
tags: project/personal
status: live
BC-regex-note-regex: "BenQ Halo Screenbar RF Controller Integration –"
BC-regex-note-field: "down"
---

Inside the project we have information about the project, then relevant sections:

'## Next actions' and '## Future next actions'

The next actions block has GTD quality next actions that can be actioned now. Future Next Actions has GTD-quality actions that are dependent on something happening first. 

The current flow handles a mind sweep or an inbox process, where we give it a list of items and it helps us process them into projects and next actions.

We want to give the app knowledge of our current projects so that it can help us process the inbox items into the right projects and suggest next actions that are relevant to the project. It should always give the user the option of creating a new project and only suggest existing projects if they are relevant to the inbox item.

This will be an Obsidian plugin.
