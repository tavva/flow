# Create Person Command

## Summary

Add a "Create person" command to the Flow plugin so users can scaffold person notes via the command palette, mirroring the existing "Create new project" command pattern.

Prompted by [Discussion #35](https://github.com/tavva/flow/discussions/35).

## Components

### 1. Settings additions

- `personsFolderPath: string` (default `"People"`) — folder where person notes are created
- `personTemplateFilePath: string` (default `"Templates/Person.md"`) — path to person template file

Both configurable in the settings tab.

### 2. Default person template

```markdown
---
creation-date: {{ date }}T{{ time }}
tags: person
---

## Discuss next
```

Template variables: `{{ date }}` (YYYY-MM-DD), `{{ time }}` (HH:MM:00) — same as the project template.

### 3. NewPersonModal

A simple modal with:
- Name text input (required)
- Creates file at `{personsFolderPath}/{sanitizedName}.md`
- Reads template from `personTemplateFilePath`, falls back to hardcoded default if template file missing
- Replaces `{{ name }}`, `{{ date }}`, `{{ time }}` template variables
- Errors if file already exists
- Opens the file after creation

### 4. Command registration

`addCommand` in `main.ts` with id `create-person`, name `Create person`, wired to open `NewPersonModal`. Same pattern as "Create new project".

## What's excluded

- No sphere/priority/status — person notes don't use these
- No AI integration
- No pre-population of "Discuss next" items
