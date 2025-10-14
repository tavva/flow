# GTD Coach CLI

A conversational CLI tool for AI-powered GTD coaching using your Flow vault data.

## Overview

The GTD Coach CLI loads your complete GTD system from a specified sphere and provides an interactive REPL where you can have conversations with an AI GTD expert about all aspects of your GTD practice.

The coach has access to:

- Your Flow projects with priorities, statuses, and next actions
- Central next actions file
- Someday/maybe items
- Unprocessed inbox items

## Installation

No separate installation needed - the CLI is part of the Flow GTD Coach plugin repository.

## Usage

```bash
npx tsx src/cli.ts --vault /path/to/vault --sphere work
```

**Required arguments:**

- `--vault` - Path to your Obsidian vault
- `--sphere` - Sphere to filter projects (e.g., 'work', 'personal')

## Configuration

The CLI uses the same API key and model configuration as the Obsidian plugin. Configure these in Obsidian via Settings → Flow GTD Coach before using the CLI.

## REPL Commands

- `exit` or `quit` - Exit the CLI
- `reset` - Start a fresh conversation (clears history)

## What the Coach Can Help With

The GTD Coach can provide advice on:

- **Prioritisation** - Which projects or actions to focus on given your goals, time, and energy
- **Project Quality** - Are your project outcomes clear? Are next actions well-defined?
- **Next Action Quality** - Are actions specific enough? Do they start with verbs?
- **GTD Processes** - Weekly reviews, inbox processing, project planning workflows
- **System Health** - Projects without next actions, growing inboxes, unclear outcomes
- **Methodology Questions** - General GTD principles and best practices

**Important:** The coach is read-only and provides advice only - it cannot edit your files.

## Example Sessions

### Prioritisation

```
$ npx tsx src/cli.ts --vault ~/my-vault --sphere work

Flow GTD Coach - work sphere
  15 projects
  23 next actions
  8 someday items
  3 inbox items

> I have 2 hours this afternoon. What should I focus on?

[AI analyzes your projects and suggests specific actions based on priorities]
```

### Project Review

```
> Can you review my "Website Redesign" project and tell me if it's well-formed?

[AI checks if outcome is clear, next actions are specific, etc.]
```

### Weekly Review

```
> Help me do a weekly review. What should I look at first?

[AI guides you through reviewing projects, clearing inbox, etc.]
```

### Next Action Quality

```
> Are these good next actions? "fix the bug", "update docs", "call client"

[AI evaluates action quality and suggests improvements]
```

## Conversation Context

The CLI maintains conversation history across turns, so you can have natural back-and-forth discussions. The AI remembers your stated priorities and previous questions within the session.

Use `reset` if you want to start a fresh conversation without previous context.

## Tips

- Be specific about your constraints (time, energy, deadlines)
- Ask the coach to review specific projects or actions
- Use the coach for weekly review guidance
- Ask for help improving vague next actions
- Discuss GTD methodology when you're unsure about best practices
