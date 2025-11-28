// ABOUTME: Utilities for parsing checkbox/task lines in Markdown.
// ABOUTME: Extracts status characters, action text, and provides type predicates.

export type CheckboxStatus = "todo" | "waiting" | "done";

/**
 * Pattern matching checkbox lines with any status (space, w/W, x/X)
 * Supports both - and * bullet markers
 * Allows optional leading whitespace for indented items
 */
const CHECKBOX_PATTERN = /^(\s*[-*]\s*)\[([ wWxX])\]\s*(.*)$/;

/**
 * Check if a line contains a checkbox (task)
 */
export function isCheckboxLine(line: string): boolean {
  return CHECKBOX_PATTERN.test(line);
}

/**
 * Extract the checkbox status from a line
 * Returns null if the line is not a checkbox
 */
export function extractCheckboxStatus(line: string): CheckboxStatus | null {
  const match = line.match(CHECKBOX_PATTERN);
  if (!match) {
    return null;
  }

  const statusChar = match[2].toLowerCase();
  if (statusChar === " ") return "todo";
  if (statusChar === "w") return "waiting";
  if (statusChar === "x") return "done";

  return null;
}

/**
 * Extract the action text from a checkbox line
 * Returns empty string if the line is not a checkbox
 */
export function extractActionText(line: string): string {
  const match = line.match(CHECKBOX_PATTERN);
  if (!match) {
    return "";
  }
  return match[3].trim();
}

/**
 * Check if a line is an unchecked checkbox (todo item)
 */
export function isUncheckedCheckbox(line: string): boolean {
  return extractCheckboxStatus(line) === "todo";
}

/**
 * Check if a line is a waiting-for checkbox
 */
export function isWaitingForCheckbox(line: string): boolean {
  return extractCheckboxStatus(line) === "waiting";
}

/**
 * Check if a line is a completed checkbox
 */
export function isCompletedCheckbox(line: string): boolean {
  return extractCheckboxStatus(line) === "done";
}
