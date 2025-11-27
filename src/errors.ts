// ABOUTME: Custom error types for the Flow plugin providing type-safe error handling.
// ABOUTME: Includes network, file, configuration, validation, and LLM response errors.

/**
 * Options for error creation with cause tracking.
 */
interface FlowErrorOptions {
  cause?: Error;
}

/**
 * Base error class for all Flow-specific errors.
 * Provides consistent error handling across the plugin.
 */
export class FlowError extends Error {
  readonly cause?: Error;

  constructor(message: string, options?: FlowErrorOptions) {
    super(message);
    this.name = "FlowError";
    this.cause = options?.cause;
    // Restore prototype chain for proper instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when network operations fail (connection, timeout, DNS).
 * These errors are retryable.
 */
export class NetworkError extends FlowError {
  constructor(message: string, options?: FlowErrorOptions) {
    super(message, options);
    this.name = "NetworkError";
  }
}

/**
 * Error thrown when a required file cannot be found.
 */
export class FileNotFoundError extends FlowError {
  readonly filePath: string;

  constructor(filePath: string, options?: FlowErrorOptions) {
    super(`File not found: ${filePath}`, options);
    this.name = "FileNotFoundError";
    this.filePath = filePath;
  }
}

/**
 * Error thrown when plugin configuration is invalid or missing.
 */
export class ConfigurationError extends FlowError {
  constructor(message: string, options?: FlowErrorOptions) {
    super(message, options);
    this.name = "ConfigurationError";
  }
}

/**
 * Error thrown when user input or data validation fails.
 */
export class ValidationError extends FlowError {
  readonly field?: string;

  constructor(message: string, field?: string, options?: FlowErrorOptions) {
    super(message, options);
    this.name = "ValidationError";
    this.field = field;
  }
}

/**
 * Error thrown when LLM response is invalid or malformed.
 */
export class LLMResponseError extends FlowError {
  constructor(message: string, options?: FlowErrorOptions) {
    super(message, options);
    this.name = "LLMResponseError";
  }
}

/**
 * Error thrown when GTD-specific validation of LLM responses fails.
 * Extends LLMResponseError for backward compatibility.
 */
export class GTDResponseValidationError extends LLMResponseError {
  constructor(message: string, options?: FlowErrorOptions) {
    super(message, options);
    this.name = "GTDResponseValidationError";
  }
}

/**
 * Type guard to check if an error is a NetworkError.
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Determines if an error is retryable.
 * NetworkError instances are always retryable.
 * Generic Errors with network-like messages are retryable for backward compatibility.
 */
export function isRetryableError(error: unknown): boolean {
  // NetworkError is always retryable
  if (error instanceof NetworkError) {
    return true;
  }

  // Other FlowError subclasses are not retryable
  if (error instanceof FlowError) {
    return false;
  }

  // Legacy support: generic Error with network-like messages
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const retryableKeywords = [
      "fetch",
      "network",
      "timeout",
      "econnrefused",
      "enotfound",
      "econnreset",
      "etimedout",
    ];
    return retryableKeywords.some((keyword) => message.includes(keyword));
  }

  return false;
}
