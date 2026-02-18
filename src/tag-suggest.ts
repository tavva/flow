// ABOUTME: Inline tag autocomplete for text inputs using Obsidian's AbstractInputSuggest.
// ABOUTME: Provides vault tag suggestions when user types # in the input field.

import { AbstractInputSuggest, App } from "obsidian";

/**
 * Finds a #tag fragment at the given cursor position in text.
 * Returns the fragment's start/end indices and the fragment string,
 * or null if the cursor is not within a tag fragment.
 */
export function findTagAtCursor(
  text: string,
  cursorPos: number
): { start: number; end: number; fragment: string } | null {
  // Scan backwards from cursor to find a # that starts a tag
  let hashPos = -1;
  for (let i = cursorPos - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "#") {
      // # must be at start of text or preceded by whitespace to be a tag
      if (i === 0 || /\s/.test(text[i - 1])) {
        hashPos = i;
      }
      break;
    }
    // Stop scanning if we hit whitespace (no # in this word)
    if (/\s/.test(ch)) {
      break;
    }
  }

  if (hashPos === -1) {
    return null;
  }

  const fragment = text.slice(hashPos, cursorPos);
  return { start: hashPos, end: cursorPos, fragment };
}

/**
 * Replaces a tag fragment in text at the given position with a replacement string.
 */
export function replaceTagFragment(
  text: string,
  start: number,
  end: number,
  replacement: string
): string {
  return text.slice(0, start) + replacement + text.slice(end);
}

/**
 * Inline tag suggester for text inputs.
 * Triggers when user types # and suggests matching vault tags.
 */
export class TagSuggest extends AbstractInputSuggest<string> {
  private inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  getSuggestions(inputStr: string): string[] {
    const cursorPos = this.inputEl.selectionStart ?? inputStr.length;
    const tagInfo = findTagAtCursor(inputStr, cursorPos);

    if (!tagInfo) {
      return [];
    }

    const allTags = (this.app.metadataCache as any).getTags() as Record<string, number>;
    if (!allTags) {
      return [];
    }

    const lowerFragment = tagInfo.fragment.toLowerCase();

    return Object.keys(allTags)
      .filter((tag) => tag.toLowerCase().startsWith(lowerFragment))
      .sort((a, b) => {
        // Sort by usage count descending
        return (allTags[b] || 0) - (allTags[a] || 0);
      })
      .slice(0, 20);
  }

  renderSuggestion(tag: string, el: HTMLElement): void {
    el.setText(tag);
  }

  selectSuggestion(tag: string, _evt: MouseEvent | KeyboardEvent): void {
    const text = this.inputEl.value;
    const cursorPos = this.inputEl.selectionStart ?? text.length;
    const tagInfo = findTagAtCursor(text, cursorPos);

    if (!tagInfo) {
      return;
    }

    const newText = replaceTagFragment(text, tagInfo.start, tagInfo.end, tag);
    this.setValue(newText);

    // Place cursor after the inserted tag
    const newCursorPos = tagInfo.start + tag.length;
    this.inputEl.setSelectionRange(newCursorPos, newCursorPos);
  }
}
