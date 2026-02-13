# Project Templates

Flow uses a template file to create new project notes during inbox processing. You can customise this template to match your workflow.

## Setup

1. Create a template file anywhere in your vault (default: `Templates/Project.md`)
2. Set the path in Settings → Flow → Project Template File
3. New projects created during inbox processing will use your template

If the template file doesn't exist, Flow uses a built-in default.

## Template Variables

Flow replaces these variables when creating a project:

| Variable            | Replaced with                      | Example                    |
| ------------------- | ---------------------------------- | -------------------------- |
| `{{ date }}`        | Current date (YYYY-MM-DD)          | `2025-10-05`               |
| `{{ time }}`        | Current time (HH:mm)               | `14:30`                    |
| `{{ priority }}`    | Project priority (1-5)             | `2`                        |
| `{{ status }}`      | Default status from settings       | `live`                     |
| `{{ sphere }}`      | Sphere tag(s) for the project      | `project/work`             |
| `{{ description }}` | Description or original inbox item | `Original inbox item: ...` |

## Example Template

```markdown
---
creation-date: {{ date }}
priority: {{ priority }}
tags:
  - {{ sphere }}
status: {{ status }}
---

# Description

{{ description }}

## Next actions

## Notes + resources
```

Flow automatically adds next actions to the `## Next actions` section, so leave it empty in your template.

## Templater Compatibility

If you use the [Templater](https://github.com/SilentVoid13/Templater) plugin, Flow will automatically process Templater syntax (`<% ... %>`) after creating the file. You can mix Flow variables with Templater commands in the same template:

```markdown
---
creation-date: <% tp.date.now("YYYY-MM-DDTHH:mm:00") %>
priority: {{ priority }}
tags:
  - {{ sphere }}
status: {{ status }}
---

# Description

{{ description }}

## Next actions

## Notes + resources
```

Templater processing requires Templater to be installed and enabled. If Templater is not installed, `<% %>` syntax will remain as-is in the created file.
