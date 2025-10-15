# Flow

## What is Flow?

Flow is a life planning system built on David Allen's Getting Things Done (GTD).

> "_Paper is to write things down that we need to remember. Our brains are used to think_." ― Albert Einstein.

Your mind is for having ideas, not holding them.

Keeping track of life's demands—from buying cat food to completing a project at work—consumes mental resources you should spend on the task at hand.

Flow captures every project, task, and idea in Obsidian. With these items out of your head, you can think clearly and focus completely.

When you work in a flow state, distractions vanish. Yet thoughts constantly intrude: tasks you might forget, obligations you must remember. Flow captures these thoughts immediately, preserving your focus.

Flow helps you plan your day around what matters, not what feels urgent.

## Is Flow for me?

Flow is for you if you:

- Have a lot of things to do and are struggling to keep track of them
- Often forget things you need to do
- Can't focus on something important because other things are popping up in your head
- Often feel overwhelmed at all the open loops you have in your life
- Feel unorganised and want to get on top of things
- Struggle to get into a flow state
- Want to feel in control
- Wear multiple hats, work, family, personal projects, etc.
- Have tried other systems and they haven't worked for you
- Are neurodiverse and have trouble focusing or struggle with executive function

## How does it work?

Flow follows a core principle:

> Flow should not dictate how you store your information in Obsidian.

Flow is an Obsidian plugin built for Obsidian users. You must use Obsidian to use Flow.

Flow adapts to your vault's organisation. While opinionated about some aspects of GTD, Flow preserves Obsidian's flexibility.

### Why Flow helps keep your mind like water

Thoughts and demands arrive constantly: email, phone calls, conversations, mail. Flow captures everything—ideas, tasks, requests—the moment it appears. Once captured, you can think freely about your current work.

## Features

### Capture: Get Everything Out of Your Head

Capture thoughts, tasks, and ideas instantly:

- **Quick Capture Command**: Click 'Add to inbox' or the ribbon icon
- **Multiple Inboxes**: Separate work, personal, and other captures
- **Mobile Integration**: Obsidian notes are text files—capture via Siri Shortcuts, Alfred workflows, Tasker, Funnel, or any tool you prefer

#### Quick Capture Methods

Capture techniques for different platforms:

Two articles covering Quick Capture methods:
- https://obsidian.rocks/obsidian-quick-capture/
- https://obsidian.rocks/obsidian-mobile-quick-capture/

**General:**
- https://obsidian.md/clipper

**Mac:**
- https://actions.work/actions-for-obsidian
- https://www.raycast.com/KevinBatdorf/obsidian

**Windows:**
- Nothing here yet, please let us know if you have a good quick capture method!

**iOS:**
- https://actions.work/actions-for-obsidian
- https://www.notesightlabs.com/funnel
- https://www.icloud.com/shortcuts/9a6af22443414858bb6adade86a30f85

**Android:**
- https://play.google.com/store/apps/details?id=net.dinglisch.android.taskerm&hl=en_GB
- https://play.google.com/store/apps/details?id=net.gsantner.markor
- https://forum.obsidian.md/t/android-quick-input-for-obsidian/16336
- https://play.google.com/store/apps/details?id=com.xectrone.quickmark

### Process: AI-Powered GTD Workflow

AI processes your inbox according to GTD principles:

- **Intelligent Categorisation**: Categorises items as projects, next actions, reference material, or someday/maybe items
- **Context-Aware Suggestions**: Scans existing Flow projects to suggest where new actions belong
- **Action Quality Enhancement**: Refines vague inputs into clear, actionable next actions
- **Waiting For Detection**: Identifies items requiring others and creates them with `[w]` status
- **Project Creation**: Transforms multi-step outcomes into Flow project files
- **Multiple LLM Support**: Works with Anthropic Claude or OpenAI-compatible APIs (OpenRouter, local providers)

**AI Recommendations:**

AI provides two signals:
- **Recommended Action**: Primary instruction (_Create New Project_, _Add to Project_, _File to Reference_) applied directly
- **Suggested Projects/People**: Optional matches with confidence levels for manual redirection

### Organise: Structured Project Management

Flow organises your work into hierarchical structure:

- **Sphere-Based Organisation**: Organise life areas (work, personal, etc.) into spheres
- **Project Hierarchy**: Create sub-projects under parent projects with unlimited nesting depth
- **Next Actions Lists**: Each project maintains actionable next steps
- **Flow Frontmatter**: Projects use YAML frontmatter for priority, status, tags, and metadata
- **Person Notes Integration**: Link actions to people in your network

**Project Structure:**

```markdown
---
creation-date: 2025-10-05 18:59
priority: 2
tags: project/personal
status: live
parent-project: "[[Parent Project]]"  # optional, for sub-projects
---

# Project Title

Project description and context.

## Next actions

- [ ] Specific, actionable items ready to do now
- [w] Items waiting on others
```

### Plan: Focus on What Matters

Plan your day and maintain focus:

- **Sphere Views**: See all projects and actions within a life area
- **Hotlist**: Curate a focused set of next actions from across your vault
- **Planning Mode**: Click actions from sphere view to add them to your hotlist
- **Visual Indicators**: See which actions are in your hotlist at a glance
- **Priority-Based Planning**: Focus on high-priority projects and actions

### Waiting For Management

GTD "Waiting For" lists use `[w]` checkbox status:

**Creating:**
- AI detects items requiring others during inbox processing
- Mark actions manually in inbox modal
- Use "Cycle task status" command on existing tasks

**Viewing:**
- Dedicated Waiting For view shows all `[w]` items across your vault
- Groups items by project
- Click items to jump to source file
- Mark complete (✓) or convert to regular action (←)

**Keyboard:**
Place cursor on any checkbox and run "Cycle task status": `[ ]` → `[w]` → `[x]`

## Installation

1. Download the latest release
2. Extract files to `.obsidian/plugins/flow/` in your vault
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

To build from source:

```bash
git clone https://github.com/yourusername/flow.git
cd flow
npm install
npm run build        # production build
npm run dev          # development with auto-rebuild
```

## Setup

### API Configuration

1. Choose your LLM provider in Settings → Flow:
   - **Anthropic Claude** (recommended): Get an API key from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
   - **OpenAI-compatible**: Configure any OpenAI-compatible API endpoint (OpenRouter, local providers)

2. Enter your API key

3. Configure defaults:
   - Default priority for new projects (1-3)
   - Default status for new projects (live, planning, etc.)
   - Available spheres (work, personal, etc.)

### File Paths

Configure where Flow stores content:

- **Inbox Files Folder**: Where inbox items are stored (default: "Flow Inbox Files")
- **Inbox Folder**: General inbox location (default: "Flow Inbox Folder")
- **Next Actions File**: Central next actions file (default: "Next actions.md")
- **Someday File**: Someday/maybe file (default: "Someday.md")
- **Projects Folder**: Where new project files are created (default: "Projects")

## How to Use Flow

The Flow workflow follows GTD principles: **Capture → Process → Plan**

### Step 1: Capture

When something has your attention, capture it immediately:

1. Click the inbox ribbon icon or run "Add to inbox" command
2. Type or paste your thought, task, or idea
3. Don't worry about formatting – just get it out of your head

Remember: If it's in your head, it's taking up mental space. Capture it in Flow.

### Step 2: Process

Process your inbox regularly (daily recommended):

1. Click the "Process Inbox" ribbon icon or run "Start processing" command
2. For each item, AI analyses and suggests:
   - What category it belongs to (project, action, reference, someday, person)
   - Which existing project it might belong to
   - How to refine it into a clear, actionable item
3. Review the suggestion and adjust as needed
4. Choose where to save it (new project, existing project, next actions, etc.)
5. Move to the next item

**Processing from Inbox Folders:**

Process entire folders of captured items:
- Run "Process Inbox Folders" command
- Select items from your configured inbox folder
- Process them as individual captures

### Step 3: Plan

Decide what to work on today:

1. Run "Open planning view" command
2. Open the sphere you want to plan from (work, personal, etc.)
3. Enter planning mode
4. Click actions from projects to add them to your hotlist
5. Exit planning mode
6. Open your hotlist to see your curated actions

**Using the Hotlist:**

Your focused list of actions for today or this week:
- Click action text to open the source file
- Mark actions complete when done
- Convert to waiting-for if blocked
- Remove actions if priorities change

**Reviewing Sphere Views:**

Sphere views show all projects and actions within a life area:
- Project hierarchy with sub-projects indented
- Next actions aggregated from projects
- Toggle between spheres
- Bring project files to the front

### Step 4: Review (Weekly)

Review regularly to keep your system trusted and current:

1. Process all inboxes to zero
2. Review each sphere for completed projects and stale actions
3. Update project statuses and priorities
4. Check your waiting-for list for items to follow up
5. Review someday/maybe list for items ready to activate

## GTD Principles

Flow implements core GTD workflow:

1. **Capture** - Collect everything that has your attention
2. **Clarify** - Process what each item means
3. **Organise** - Put it where it belongs
4. **Review** - Look over your system regularly
5. **Engage** - Do what needs doing

### GTD Categories

AI categorises items according to GTD:

- **Next Action**: Single completable actions (enhanced for specificity and clarity)
- **Project**: Multi-step outcomes requiring multiple actions
- **Reference**: Information to store for future reference (not actionable now)
- **Someday/Maybe**: Future aspirations and ideas (not committed now)
- **Person**: People-related items to add to person notes

### Quality Standards

Flow helps to enforce GTD quality standards:

**Next Actions MUST:**
- Start with an action verb
- Be specific and completable in one sitting
- Include context (who, where, what specifically)
- Be 15-150 characters long
- Avoid vague terms ("something", "maybe", "stuff")

Examples:
- ✓ Good: "Call Dr. Smith's office at 555-0123 to schedule cleaning"
- ✗ Bad: "dentist"

**Project Outcomes MUST:**
- Be stated as completed outcomes (past tense ideal)
- Be clear and measurable
- Define "done"

Examples:
- ✓ Good: "Website redesign complete and deployed"
- ✗ Bad: "Work on website"

## Privacy & Security

- API key stored locally in Obsidian settings
- Data sent only to your chosen LLM provider
- Processing on-demand only
- Vault data stays under your control
- Plugin runs locally; no third-party access to credentials
- No telemetry or analytics

## Development

### Common Commands

```bash
# Development mode with auto-rebuild
npm run dev

# Type-check and build for production
npm run build

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report (requires 80% coverage)
npm run test:coverage

# Format code with Prettier
npm run format

# Check if code is formatted
npm run format:check
```

### GTD Coach CLI

For testing and automation:

```bash
# Interactive GTD coaching for a specific sphere
npx tsx src/cli.ts --vault /path/to/vault --sphere work
```

See `docs/gtd-coach-cli.md` for full CLI documentation.

### Evaluation Framework

Measure GTD processing quality:

```bash
export ANTHROPIC_API_KEY=your-key
npm run evaluate
```

Tests 15 curated cases, generates quality metrics, and saves results to `evaluation/results/`. See `evaluation/README.md` for details.

### Project Structure

```
src/
├── types.ts                    # TypeScript interfaces
├── flow-scanner.ts             # Vault scanner for Flow projects
├── person-scanner.ts           # Person notes scanner
├── inbox-scanner.ts            # Inbox folder scanner
├── gtd-processor.ts            # AI-powered GTD analysis
├── llm-factory.ts              # LLM provider factory
├── anthropic-client.ts         # Anthropic API client
├── openai-compatible-client.ts # OpenAI-compatible API client
├── file-writer.ts              # Project file creation/updates
├── inbox-modal.ts              # Main processing UI
├── inbox-processing-controller.ts  # Processing workflow orchestration
├── settings-tab.ts             # Settings interface
├── waiting-for-scanner.ts      # Waiting-for items scanner
├── waiting-for-view.ts         # Waiting-for view
├── task-status-cycler.ts       # Checkbox status cycling
├── hotlist-validator.ts        # Hotlist validation
├── hotlist-view.ts             # Hotlist view
├── action-line-finder.ts       # Action line number detection
├── project-hierarchy.ts        # Project hierarchy building
├── sphere-view.ts              # Sphere view with planning mode
├── validation.ts               # Input validation
└── errors.ts                   # Custom error types
tests/                          # Test files mirror src/
main.ts                         # Plugin entry point
```

### Testing

- Located in `tests/` directory
- Uses Jest with ts-jest preset
- Mock Obsidian API via `tests/__mocks__/obsidian.ts`
- Coverage thresholds: 80% for branches, functions, lines, statements

Run specific tests:

```bash
# Run a specific test file
npm test -- flow-scanner.test

# Run tests matching a pattern
npm test -- --testNamePattern="should scan vault"
```

### Code Formatting

- Uses Prettier
- Configuration: `.prettierrc.json`
- Style: 2-space indentation, 100-character line width, semicolons, double quotes
- Auto-format: Run `npm run format` before committing
- CI Check: GitHub Actions runs `npm run format:check` on all PRs

## Architecture

See `CLAUDE.md` for detailed architecture documentation, including:

- Core processing flow
- Waiting For support
- Hotlist support
- Sub-projects support
- Flow project structure
- API integration patterns
- Testing patterns
- Important implementation patterns

## Support

- Report bugs: [GitHub Issues](https://github.com/yourusername/flow/issues)
- Feature requests: [GitHub Discussions](https://github.com/yourusername/flow/discussions)

## Current Development Focus

- Weekly review functionality
- Enhanced documentation
- Performance optimisations

## License

MIT

## Credits

- Inspired by David Allen's GTD methodology
- Powered by [Anthropic Claude](https://www.anthropic.com/) and OpenAI-compatible APIs
- Built for the Obsidian community
