# Sub-Projects Implementation Handoff

**Status**: ✅ **Feature is production-ready and fully functional**

**Date**: 2025-10-15

## What We Built

We implemented a hierarchical sub-projects feature for the Flow GTD Coach plugin. Sub-projects are separate project files that can be linked to parent projects using frontmatter references.

### Key Design Decisions

1. **Parent Reference via Frontmatter**: Sub-projects reference their parent using `parent-project: "[[Parent Name]]"` in frontmatter
2. **Arbitrary Nesting**: Sub-projects can have their own sub-projects (unlimited depth)
3. **Hierarchical Aggregation**: Viewing a parent shows all next actions from descendants
4. **Cross-Sphere Support**: Build hierarchy from all projects first, then filter by sphere (preserves relationships even when parent is in different sphere)
5. **Manual Lifecycle**: Sub-project completion is coordinated manually (no automatic cascading)
6. **Sphere Inheritance**: Sub-projects should use same sphere tags as parent (guideline, not enforced)

## What Works Now

### ✅ Core Infrastructure

- `src/types.ts`: FlowProject interface has `parentProject?: string` field
- `src/project-hierarchy.ts`: Complete hierarchy building with cycle detection, depth tracking, and action aggregation
- All 260 tests passing
- Build successful

### ✅ File Operations

- `src/file-writer.ts`: Can write `parent-project` frontmatter when creating projects
- `src/flow-scanner.ts`: Reads parent-project from frontmatter, provides `scanProjectTree()` method

### ✅ UI Views - All Working

1. **Sphere View** (`src/sphere-view.ts`):
   - Shows hierarchical indentation (24px per depth level)
   - Builds hierarchy from ALL projects first, then filters to sphere
   - Sub-projects have `.flow-gtd-sphere-subproject` class

2. **Hotlist View** (`src/hotlist-view.ts`):
   - Shows parent context in parentheses: "Sub-project (Parent)"
   - Parent text styled smaller (0.85em), dimmed (0.7 opacity), not bold
   - Uses `getProjectDisplayName()` helper

3. **CLI** (`src/cli.ts`):
   - System prompt shows hierarchical structure with indentation
   - Counts include all sub-projects
   - Displays depth information

### ✅ AI Integration

- `src/gtd-processor.ts`: Updated prompts and parsing for sub-project suggestions
- AI can suggest `asSubProject: true` with `parentProject` path
- `ProjectSuggestion` interface includes sub-project fields

## Manual Testing Performed

Ben tested by manually adding frontmatter:

- ✅ Hotlist displays parent context with correct styling
- ✅ Sphere view shows nested hierarchy with indentation
- ✅ All views handle sub-projects correctly

## What's Left (Optional Enhancements)

These are **nice-to-have** improvements, not blockers:

### 1. Inbox Modal Sub-Project Creation Flow

**File**: `src/inbox-modal.ts`

**Current State**: AI can suggest sub-projects, but UI doesn't support creating them yet

**What's Needed**:

- When AI suggests `asSubProject: true`, show parent context in project suggestions
- When user selects a sub-project suggestion, pass `parentProject` to file-writer
- UI indication that this will be created as a sub-project

**Complexity**: Medium - requires modal UI changes and workflow adjustments

### 2. Comprehensive Hierarchy Tests

**File**: `tests/project-hierarchy.test.ts` (doesn't exist yet)

**What's Needed**:

```typescript
describe("buildProjectHierarchy", () => {
  it("should detect cycles and prevent infinite loops");
  it("should calculate correct depth for nested sub-projects");
  it("should aggregate next actions from all descendants");
  it("should handle missing parent references gracefully");
  it("should build correct tree with multiple roots");
});

describe("flattenHierarchy", () => {
  it("should flatten in correct depth-first order");
  it("should preserve depth information");
});

describe("getProjectDisplayName", () => {
  it("should return primary name and parent context");
  it("should handle projects without parents");
  it("should handle missing parent files");
});
```

**Complexity**: Low - straightforward unit tests

### 3. Documentation Update

**File**: `CLAUDE.md`

**What's Needed**:

- Add section on sub-projects architecture
- Document frontmatter parent-project field
- Explain hierarchy building approach
- Document `project-hierarchy.ts` utilities

**Complexity**: Low - documentation only

## Critical Implementation Details

### Hierarchy Building Algorithm (sphere-view.ts)

**IMPORTANT**: Must build hierarchy from ALL projects first, then filter:

```typescript
// ✅ CORRECT
const allProjects = await this.scanner.scanProjects();
const hierarchy = buildProjectHierarchy(allProjects);
const flattenedHierarchy = flattenHierarchy(hierarchy);
const projectSummaries = flattenedHierarchy.filter(/* sphere filter */);

// ❌ WRONG - breaks nesting when parent is in different sphere
const sphereProjects = allProjects.filter(/* sphere filter */);
const hierarchy = buildProjectHierarchy(sphereProjects);
```

**Why**: If parent is in different sphere or not "live", filtering before building hierarchy loses the parent-child relationship.

### Parent Context Styling (hotlist-view.ts)

```typescript
if (displayName.parent) {
  const parentSpan = fileHeader.createSpan({
    text: ` (${displayName.parent})`,
    cls: "flow-gtd-hotlist-parent-context",
  });
  parentSpan.style.fontSize = "0.85em"; // Smaller
  parentSpan.style.opacity = "0.7"; // Dimmed
  parentSpan.style.fontWeight = "normal"; // Not bold
}
```

### Indentation Calculation (sphere-view.ts)

```typescript
if (depth > 0) {
  wrapper.style.paddingLeft = `${depth * 24}px`;
  wrapper.addClass("flow-gtd-sphere-subproject");
}
```

24px per depth level provides clear visual hierarchy.

## How to Use (For Users)

### Creating a Sub-Project Manually

Add frontmatter to the sub-project file:

```yaml
---
creation-date: 2025-10-15
priority: 2
tags: project/work
status: live
parent-project: "[[Engineering AI Strategy]]"
---

# Ship initial AI-first experiment

Description of the sub-project...

## Next actions
- [ ] Specific action for this sub-project
```

### Viewing Hierarchy

1. **Sphere View**: Sub-projects appear indented under their parents
2. **Hotlist**: Shows "Sub-project (Parent)" format
3. **CLI**: System prompt shows indented tree structure

### Best Practices

- Sub-projects should have same sphere tags as parent (not enforced, but recommended)
- Each sub-project should have clear, specific next actions
- Parent projects can have their own next actions separate from sub-project actions

## Testing Verification

All existing tests pass (260 tests):

- `npm test` - ✅ All passing
- `npm run build` - ✅ Successful
- Manual testing - ✅ UI displays correctly

## Files Changed

### Core Implementation (8 files)

1. `src/types.ts` - Added parentProject field
2. `src/project-hierarchy.ts` - **NEW FILE** - Hierarchy logic
3. `src/flow-scanner.ts` - Extract parent-project from frontmatter
4. `src/file-writer.ts` - Write parent-project frontmatter
5. `src/sphere-view.ts` - Hierarchical display with indentation
6. `src/hotlist-view.ts` - Parent context display
7. `src/cli.ts` - Hierarchical system prompt
8. `src/gtd-processor.ts` - Sub-project suggestions

### Tests Updated (1 file)

1. `tests/hotlist-view.test.ts` - Added scanner mock

## Next Session Action Items

**If continuing with optional enhancements:**

1. **Start with tests** (easiest win):
   - Create `tests/project-hierarchy.test.ts`
   - Test cycle detection, depth calculation, action aggregation
   - Should be straightforward unit tests

2. **Then documentation**:
   - Update CLAUDE.md with sub-projects section
   - Document hierarchy building approach
   - Add examples of frontmatter usage

3. **Finally inbox modal** (if needed):
   - Only if Ben wants AI-suggested sub-projects to be creatable from inbox UI
   - Requires more thought about UX flow

**If no enhancements needed:**

- Feature is ready to use as-is
- Ben can create sub-projects manually via frontmatter
- All views work correctly

## Questions for Next Session

1. Do you want inbox modal to support creating sub-projects from AI suggestions?
2. How important are the hierarchy unit tests vs just relying on integration testing?
3. Any edge cases discovered during real-world usage that need handling?

---

**Bottom Line**: The sub-projects feature is fully functional and production-ready. The three remaining tasks are optional quality-of-life improvements, not blockers for using the feature.
