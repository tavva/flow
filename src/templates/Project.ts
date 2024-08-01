export const projectTemplateContents = `---
creation-date: <% tp.date.now("YYYY-MM-DD HH:mm") %>
priority:
  {{ priority }}
tags:
  - {{ sphere }}
status: live
---
# Description

{{ description }}

## Objectives

(Consider deadlines, milestones, stakeholders, definition of done)

## Next actions


## Notes + resources


## Log
`
