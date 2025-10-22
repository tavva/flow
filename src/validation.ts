/**
 * Validation utilities for Flow GTD Coach
 */

/**
 * Validates if a string is a valid API key format
 */
export function validateApiKey(apiKey: string): { valid: boolean; error?: string } {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: "API key cannot be empty" };
  }

  if (!apiKey.startsWith("sk-ant-")) {
    return { valid: false, error: 'Invalid Anthropic API key format. Should start with "sk-ant-"' };
  }

  if (apiKey.length < 20) {
    return { valid: false, error: "API key appears to be too short" };
  }

  return { valid: true };
}

/**
 * Validates if a priority value is within acceptable range
 */
export function validatePriority(priority: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(priority)) {
    return { valid: false, error: "Priority must be an integer" };
  }

  if (priority < 1 || priority > 5) {
    return { valid: false, error: "Priority must be between 1 and 5" };
  }

  return { valid: true };
}

/**
 * Validates if a status value is acceptable
 */
export function validateStatus(status: string): { valid: boolean; error?: string } {
  const validStatuses = ["live", "active", "planning", "paused", "completed"];

  if (!status || status.trim().length === 0) {
    return { valid: false, error: "Status cannot be empty" };
  }

  if (!validStatuses.includes(status.toLowerCase())) {
    return {
      valid: false,
      error: `Status must be one of: ${validStatuses.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Validates a project tag format
 */
export function validateProjectTag(tag: string): { valid: boolean; error?: string } {
  if (!tag || tag.trim().length === 0) {
    return { valid: false, error: "Tag cannot be empty" };
  }

  if (!tag.startsWith("project/")) {
    return { valid: false, error: 'Project tag must start with "project/"' };
  }

  if (tag.length <= 8) {
    // "project/" is 8 characters
    return { valid: false, error: 'Project tag must have a category after "project/"' };
  }

  // Check for invalid characters
  if (!/^[a-z0-9/_-]+$/i.test(tag)) {
    return { valid: false, error: "Project tag contains invalid characters" };
  }

  return { valid: true };
}

/**
 * Sanitizes a string for use as a filename
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // Remove invalid filename characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
    .substring(0, 255); // Limit to reasonable length
}

/**
 * Validates inbox item input
 */
export function validateInboxItem(item: string): { valid: boolean; error?: string } {
  if (!item || item.trim().length === 0) {
    return { valid: false, error: "Inbox item cannot be empty" };
  }

  if (item.length > 1000) {
    return { valid: false, error: "Inbox item is too long (max 1000 characters)" };
  }

  return { valid: true };
}

/**
 * Validates a next action according to GTD principles
 */
export function validateNextAction(action: string): { valid: boolean; warnings?: string[] } {
  const warnings: string[] = [];

  if (action.length < 10) {
    warnings.push("Next action seems too short to be specific");
  }

  // Check if it starts with a verb (common action verbs)
  const actionVerbs = [
    "call",
    "email",
    "write",
    "review",
    "research",
    "schedule",
    "book",
    "buy",
    "order",
    "create",
    "update",
    "fix",
    "test",
    "send",
    "meet",
    "discuss",
    "plan",
    "analyze",
    "prepare",
    "organize",
    "draft",
  ];

  const startsWithVerb = actionVerbs.some((verb) => action.toLowerCase().startsWith(verb));

  if (!startsWithVerb) {
    warnings.push('Next action should start with an action verb (e.g., "Call", "Email", "Write")');
  }

  // Check for vague terms
  const vagueTerms = ["something", "stuff", "things", "maybe", "possibly"];
  const hasVagueTerms = vagueTerms.some((term) => action.toLowerCase().includes(term));

  if (hasVagueTerms) {
    warnings.push("Next action contains vague terms - try to be more specific");
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validates a reminder date in YYYY-MM-DD format
 */
export function validateReminderDate(dateString: string): { valid: boolean; error?: string } {
  if (!dateString || dateString.trim().length === 0) {
    return { valid: true }; // Empty is valid (optional field)
  }

  // Check format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return { valid: false, error: "Date must be in YYYY-MM-DD format" };
  }

  // Check if it's a valid date
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return { valid: false, error: "Invalid date" };
  }

  // Check if the date reconstructs to the same string (catches invalid dates like 2025-02-30)
  const reconstructed = date.toISOString().split("T")[0];
  if (reconstructed !== dateString) {
    return { valid: false, error: "Invalid date" };
  }

  return { valid: true };
}
