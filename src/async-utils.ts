// ABOUTME: Handles intentional fire-and-forget async work with explicit rejection logging.
// ABOUTME: Provides small wrappers for host APIs that ignore returned promises.

export function runAsync(promise: Promise<unknown> | void, context: string): void {
  if (!promise) {
    return;
  }

  void promise.catch((error) => {
    console.error(context, error);
  });
}

export function wrapAsyncEvent<TEvent>(
  handler: (event: TEvent) => Promise<void>,
  context: string
): (event: TEvent) => void {
  return (event: TEvent) => {
    runAsync(handler(event), context);
  };
}
