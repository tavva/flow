# Flow GTD Coach

An Obsidian plugin that helps you implement the GTD (Getting Things Done) methodology in your Flow-based vault. This plugin uses AI to intelligently process inbox items into well-formed projects and quality next actions.

## Features

### 🧠 Intelligent Inbox Processing
- **AI-Powered Analysis**: Uses Claude AI to analyze inbox items and determine if they're projects, next actions, reference material, or someday/maybe items
- **Context-Aware**: Scans your existing Flow projects to suggest relevant projects for new actions
- **GTD-Quality Actions**: Ensures next actions are specific, actionable, and completable

### 📁 Flow Integration
- **Automatic Project Detection**: Scans your vault for Flow projects (files with `project/*` tags)
- **Smart File Creation**: Creates new project files with proper Flow frontmatter
- **Section Management**: Intelligently updates "Next actions" sections

### ✨ User-Friendly Interface
- **Guided Workflow**: Step-by-step process for capturing, clarifying, and organizing
- **Bulk Processing**: Process multiple inbox items at once
- **Project Suggestions**: Get AI suggestions for which existing projects items belong to

## Installation

### Manual Installation

1. Download the latest release
2. Extract the files to your vault's `.obsidian/plugins/flow-gtd-coach/` directory
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/flow-gtd-coach.git
cd flow-gtd-coach

# Install dependencies
npm install

# Build the plugin
npm run build

# For development with auto-rebuild
npm run dev
```

## Setup

1. Get an Anthropic API key from [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Open Obsidian Settings → Flow GTD Coach
3. Enter your API key
4. Configure default settings for new projects (priority, status)

## Usage

### Processing Your Inbox

1. Click the inbox icon in the ribbon, or use the command palette (`Cmd/Ctrl+P`) and search for "Process Inbox"
2. **Capture**: Add items one at a time or paste a bulk list
3. **Process**: Let the AI analyze each item and suggest how to handle it
4. **Review**: Check the AI's suggestions and make adjustments
5. **Save**: Save processed items to your vault

### How It Works

The plugin follows GTD principles:

- **Next Action**: Single, specific actions are identified and can be added to existing projects or saved for later
- **Project**: Multi-step outcomes are created as new Flow project files with:
  - Proper frontmatter (tags, priority, status, creation date)
  - Project description (the "why")
  - Immediate next actions that can be worked on now
- **Reference**: Information items are identified (you can file these manually)
- **Someday/Maybe**: Ideas for the future are flagged

### Example Flow

**Input:** "plan vacation to Italy"

**AI Analysis:**
- Category: Project
- Outcome: "Italy vacation fully planned and booked"
- Next Action: "Research best time to visit Italy and check Sarah's availability"

**Result:** New project file created at `Italy-vacation-fully-planned-and-booked.md` with all the details

## Flow Project Structure

This plugin works with the Flow system's project format:

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

**Note:** All actions are created as Markdown checkboxes (`- [ ]`) so you can easily track completion status.

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Evaluation Framework

The plugin includes a comprehensive evaluation framework to measure GTD processing quality:

```bash
# Run evaluation (requires API key)
export ANTHROPIC_API_KEY=your-key
npm run evaluate
```

The evaluation tests against 15 curated test cases, measuring:
- Category accuracy (project vs. action identification)
- Action quality (GTD compliance)
- Specificity and verb usage
- Project outcome clarity

See [`evaluation/README.md`](evaluation/README.md) for details.

### Project Structure

```
flow-gtd-coach/
├── src/
│   ├── types.ts              # TypeScript interfaces
│   ├── flow-scanner.ts       # Scans vault for Flow projects
│   ├── gtd-processor.ts      # AI-powered GTD analysis
│   ├── file-writer.ts        # Creates/updates project files
│   ├── inbox-modal.ts        # Main UI component
│   └── settings-tab.ts       # Settings interface
├── tests/
│   ├── flow-scanner.test.ts
│   ├── gtd-processor.test.ts
│   └── file-writer.test.ts
├── main.ts                   # Plugin entry point
├── manifest.json
└── package.json
```

## GTD Principles

This plugin implements the core GTD workflow:

1. **Capture** - Collect everything that has your attention
2. **Clarify** - Process what each item means and what to do about it
3. **Organise** - Put it where it belongs
4. **Review** - Look over your system regularly
5. **Engage** - Simply do what needs to be done

The plugin helps with steps 1-3, making it easy to get things out of your head and into your trusted system.

## Privacy & Security

- Your API key is stored locally in Obsidian's settings
- No data is sent anywhere except to Anthropic's API for processing
- All processing happens on-demand when you use the plugin
- Your vault data never leaves your control
- The plugin runs locally on your machine - your API key is never exposed to external parties
- The Anthropic SDK requires the `dangerouslyAllowBrowser` flag because Obsidian plugins run in an Electron environment. This is safe because:
  - The plugin runs entirely on your local machine
  - Your API key is only used for your own requests
  - No third parties have access to your credentials

## Support

- Report bugs: [GitHub Issues](https://github.com/yourusername/flow-gtd-coach/issues)
- Feature requests: [GitHub Discussions](https://github.com/yourusername/flow-gtd-coach/discussions)

## License

MIT

## Credits

- Built for the [Flow](https://github.com/tavva/flow-release) project management system
- Powered by [Anthropic Claude](https://www.anthropic.com/)
- Inspired by David Allen's GTD methodology
