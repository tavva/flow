# Priority Coach CLI

A conversational CLI tool for AI-powered project prioritisation using your Flow vault data.

## Overview

The Priority Coach CLI loads your Flow projects from a specified sphere and provides an interactive REPL where you can have conversations with an AI assistant about prioritising your work.

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
- `list` - Reminder to ask the AI to list projects

## Example Session

```
$ npx tsx src/cli.ts --vault ~/my-vault --sphere work

Flow Priority Coach - work sphere (15 projects loaded)
Type 'exit' to quit, 'reset' to start fresh conversation, 'list' to show projects

> my priorities this month are shipping the mobile app and hiring a designer

Based on your priorities, I'd recommend focusing on:

1. **Mobile App** (Priority 1) - This aligns directly with your goal...
[conversation continues]

> which project should I tackle first this week?

[AI responds with specific recommendation]

> exit
Goodbye!
```

## Conversation Context

The CLI maintains conversation history across turns, so you can have natural back-and-forth discussions. The AI remembers your stated priorities and previous questions within the session.

## Project Context Provided

For each project, the AI sees:

- Project name
- Description
- Priority level (1-3)
- Status
- Next actions

## Tips

- Be specific about your constraints (time, resources, dependencies)
- Mention deadlines or time horizons when relevant
- Ask follow-up questions to drill into specific projects
- Use 'reset' if you want to start a fresh prioritisation conversation
