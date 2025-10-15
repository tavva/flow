# Flow GTD Coach

An Obsidian plugin that implements GTD (Getting Things Done) in your Flow vault. Uses AI to process inbox items into projects and next actions.

## Features

### Inbox Processing

- Analyzes inbox items using Claude AI
- Categorizes as projects, next actions, reference material, or someday/maybe items
- Scans existing Flow projects to suggest where new actions belong
- Detects items requiring waiting for others; creates them with `[w]` status

### Flow Integration

- Scans vault for Flow projects (files with `project/*` tags)
- Creates project files with Flow frontmatter
- Updates "Next actions" sections

### Interface

- Guides you through capturing, clarifying, and organizing
- Processes multiple inbox items
- Shows all waiting-for items across projects in dedicated view
- Cycles task status via keyboard: todo → waiting-for → done

## Installation

1. Download the latest release
2. Extract files to `.obsidian/plugins/flow-gtd-coach/` in your vault
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

To build from source:

```bash
git clone https://github.com/yourusername/flow-gtd-coach.git
cd flow-gtd-coach
npm install
npm run build        # production build
npm run dev          # development with auto-rebuild
```

## Setup

1. Get an Anthropic API key: [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. In Obsidian Settings → Flow GTD Coach, enter your API key
3. Configure defaults for new projects (priority, status)

## Usage

### Processing Your Inbox

1. Click the inbox ribbon icon or run "Process Inbox" from command palette
2. Capture items individually or paste a list
3. Let AI analyze each item
4. Review suggestions and adjust
5. Save to vault

### AI Recommendations

AI provides two signals:

- **Recommended Action**: Primary instruction (_Create New Project_, _Add to Project_, _File to Reference_). The plugin applies this directly.
- **Suggested Projects/People**: Optional matches with confidence levels. These don't override the recommended action. Use them to manually redirect items if appropriate.

"Create New Project" alongside suggestions means "treat as new work" while showing potential matches you might reuse.

### Waiting For Items

Creates GTD "Waiting For" lists using `[w]` checkbox status.

**Creating:**
- AI detects items requiring waiting for others
- Manually mark actions in inbox modal
- Use "Cycle task status" command on existing tasks

**View:**
- Click clock ribbon icon or run "Open Waiting For view"
- Shows all `[w]` items grouped by file
- Click items to open source file
- Mark complete (✓) or convert to regular action (←)

**Keyboard:**
Place cursor on any checkbox and run "Cycle task status": `[ ]` → `[w]` → `[x]`

### How It Works

Follows GTD principles:

- **Next Action**: Single actions added to existing projects or saved for later
- **Project**: Multi-step outcomes become Flow project files with frontmatter, description, and next actions
- **Reference**: Information items identified for manual filing
- **Someday/Maybe**: Future ideas flagged

### Example

**Input:** "plan vacation to Italy"

**AI Analysis:**
- Category: Project
- Outcome: "Italy vacation fully planned and booked"
- Next Action: "Research best time to visit Italy and check Sarah's availability"

**Result:** Creates `Italy-vacation-fully-planned-and-booked.md` with details

## Flow Project Structure

Uses Flow system's project format:

```markdown
---
creation-date: 2025-10-05 18:59
priority: 2
tags: project/personal
status: live
---

# Project Title

Project description and context.

## Next actions

- [ ] Specific, actionable items ready to do now
```

All actions use Markdown checkboxes (`- [ ]`) for tracking completion.

## Development

### Tests

```bash
npm test                  # run all tests
npm run test:watch        # watch mode
npm run test:coverage     # coverage report
```

### Formatting

```bash
npm run format            # format with Prettier
npm run format:check      # check formatting (CI)
```

Uses Prettier with 2-space indentation. Run `npm run format` before committing. CI checks formatting on all PRs.

### Evaluation Framework

Measures GTD processing quality:

```bash
export ANTHROPIC_API_KEY=your-key
npm run evaluate
```

Tests 15 curated cases, measuring category accuracy, action quality, specificity, and outcome clarity. See [`evaluation/README.md`](evaluation/README.md).

### Project Structure

```
src/
├── types.ts              # TypeScript interfaces
├── flow-scanner.ts       # Vault scanner for Flow projects
├── gtd-processor.ts      # AI-powered GTD analysis
├── file-writer.ts        # Project file creation/updates
├── inbox-modal.ts        # Main UI
└── settings-tab.ts       # Settings interface
tests/                    # Test files mirror src/
main.ts                   # Plugin entry point
```

## GTD Principles

Implements core GTD workflow:

1. **Capture** - Collect everything that has your attention
2. **Clarify** - Process what each item means
3. **Organize** - Put it where it belongs
4. **Review** - Look over your system regularly
5. **Engage** - Do what needs doing

Plugin handles steps 1-3: capture, clarify, organize.

## Privacy & Security

- API key stored locally in Obsidian settings
- Data sent only to Anthropic's API for processing
- Processing happens on-demand
- Vault data stays under your control
- Plugin runs locally; no third-party access to credentials
- `dangerouslyAllowBrowser` flag required because Obsidian uses Electron (safe in this context)

## Support

- Report bugs: [GitHub Issues](https://github.com/yourusername/flow-gtd-coach/issues)
- Feature requests: [GitHub Discussions](https://github.com/yourusername/flow-gtd-coach/discussions)

## License

MIT

## Credits

- Built for the [Flow](https://github.com/tavva/flow-release) project management system
- Powered by [Anthropic Claude](https://www.anthropic.com/)
- Inspired by David Allen's GTD methodology
