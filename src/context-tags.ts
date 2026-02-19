// ABOUTME: Extracts GTD context tags (e.g. #context/X) from action line text.
// ABOUTME: Used by scanners and views for context-based filtering.

export function extractContexts(text: string, prefix: string = "context"): string[] {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`#${escaped}\\/([^\\s]+)`, "gi");
  const contexts: string[] = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const context = match[1].toLowerCase();
    if (!contexts.includes(context)) {
      contexts.push(context);
    }
  }

  return contexts;
}
