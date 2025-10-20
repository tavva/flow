# Inbox Processing View - Manual Test Plan

## Test 1: Open view from ribbon

1. Click inbox icon in ribbon
2. Verify: New tab opens with "Flow Inbox Processing" title
3. Verify: View shows inbox items

## Test 2: Open view from command palette

1. Open command palette (Cmd+P)
2. Type "Process Inbox"
3. Select command
4. Verify: New tab opens with inbox view

## Test 3: Navigate away and return

1. Open inbox processing view
2. Start AI refinement on an item
3. Navigate to a different note
4. Return to inbox processing tab
5. Verify: AI refinement results are still present
6. Verify: Can continue processing items

## Test 4: Reuse existing tab

1. Open inbox processing view (has items)
2. Navigate to different note
3. Run "Process Inbox" command again
4. Verify: Existing tab is revealed (not new tab created)

## Test 5: Restart confirmation

1. Open inbox processing view
2. Load some items (don't process yet)
3. Close the tab
4. Open inbox processing view again
5. Let items load
6. Close tab again
7. Open inbox processing view again
8. Verify: Should ask for restart confirmation
9. Click "Cancel"
10. Verify: Existing view revealed with current items
11. Run command again
12. Click "Restart"
13. Verify: View refreshes with new item load

## Test 6: Close view

1. Open inbox processing view
2. Process and save all items
3. Verify: "All items processed" message shows
4. Click "Close" button
5. Verify: Tab closes

## Test 7: Multiple spheres workflow

1. Open inbox processing view
2. Process items selecting different spheres
3. Navigate to different notes between items
4. Return and continue processing
5. Verify: All selections and edits preserved

## Test Results

Date: [Test date]
Tester: [Name]
Result: PASS/FAIL

Issues found:

- [List any issues]
