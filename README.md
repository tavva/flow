# Flow

**GTD-powered task management for Obsidian.**

Flow captures everything demanding your attention and helps you focus on what matters. Built on David Allen's Getting Things Done methodology.

[![Version](https://img.shields.io/github/v/release/tavva/flow?style=for-the-badge)](https://github.com/tavva/flow/releases)
[![Stable](https://img.shields.io/badge/status-stable-brightgreen?style=for-the-badge)](https://github.com/tavva/flow)
[![Obsidian](https://img.shields.io/badge/Obsidian-plugin-7C3AED?style=for-the-badge)](https://obsidian.md/plugins?id=flow)

## The Problem

Your mind is constantly interrupted by things you need to remember: tasks, ideas, commitments, follow-ups. These open loops consume mental energy that should go towards your actual work.

Flow gets everything out of your head and into a trusted system, so you can focus completely on what you're doing right now.

## Features

- **Quick Capture** — Get thoughts out of your head instantly via command, ribbon icon, or external tools
- **Inbox Processing** — Intuitive flow to categorise inbox items into projects, actions, reference, or someday/maybe
- **Sphere Organisation** — Organise life areas (work, personal) with hierarchical projects
- **Focus View** — Curate a focused list of next actions from across your vault
- **Waiting For** — Track items you're waiting on others to complete
- **Planning Mode** — Build your focus list by selecting actions from sphere views

## Quick Start

1. Install Flow in Obsidian (Settings → Community Plugins)
2. Click the inbox ribbon icon and capture something
3. Run "Process Inbox" to categorise items

## How It Works

**Capture** — When something has your attention, add it to your inbox. Don't organise yet, just get it out of your head.

**Process** — Review your inbox regularly. For each item you choose:

- What category it belongs to (project, action, reference, someday)
- Which existing project it might fit
- The sphere, and any other metadata required

**Plan** — Open a sphere view, enter planning mode, and click actions to add them to your focus. Your focus is your curated list of what to work on.

**Do** — Work from your focus. When done, mark complete. When blocked, convert to waiting-for.

## Project Structure

Flow projects use YAML frontmatter:

```markdown
---
priority: 2
tags: project/work
status: live
parent-project: "[[Parent Project]]"
---

# Ship v1.0

## Next actions

- [ ] Write release notes
- [ ] Update documentation
- [w] Waiting for design review from Sarah
```

## Cover Image Generation

Flow can generate cover images for projects using AI. Configure an image-capable model via [OpenRouter](https://openrouter.ai) in Settings → Flow (`openai/gpt-5-image` creates great cover images in our experience).

## Documentation

- [GTD Guide](docs/gtd-guide.md) — Understanding GTD methodology and Flow's implementation
- [Quick Capture Methods](docs/quick-capture.md) — Tools and workflows for capturing from any device
- [Contributing](CONTRIBUTING.md) — Development setup, architecture, and how to contribute

## Privacy

- AI features are optional and disabled by default — Flow works fully without them
- API keys stored locally in Obsidian settings
- Project data sent to your configured LLM provider if enabled (it's optional)
- No telemetry or analytics
- Your vault stays under your control

## Support

- [Report bugs](https://github.com/tavva/flow/issues)
- [Discussions](https://github.com/tavva/flow/discussions)

## Licence

GPL-3.0 — see [LICENSE](LICENSE) for details.
