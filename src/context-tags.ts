// ABOUTME: Extracts GTD context tags (#context/X) from action line text.
// ABOUTME: Used by scanners and views for context-based filtering.

const CONTEXT_TAG_PATTERN = /#context\/([^\s]+)/gi;

export function extractContexts(text: string): string[] {
  const contexts: string[] = [];
  let match;

  while ((match = CONTEXT_TAG_PATTERN.exec(text)) !== null) {
    const context = match[1].toLowerCase();
    if (!contexts.includes(context)) {
      contexts.push(context);
    }
  }

  // Reset lastIndex since we're using a global regex
  CONTEXT_TAG_PATTERN.lastIndex = 0;

  return contexts;
}
