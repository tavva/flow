// ABOUTME: Coordinates focus file reads, writes, and moves within each vault.
// ABOUTME: Redirects pending operations to a successfully moved file's new location.

import { Vault } from "obsidian";

const pendingOperations = new WeakMap<Vault, Promise<unknown>>();
const movedPaths = new WeakMap<Vault, Map<string, string>>();

export function withFocusFileLock<T>(vault: Vault, operation: () => Promise<T>): Promise<T> {
  const previous = pendingOperations.get(vault) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  // Store a fulfilled tail so failed operations cannot block later reads or writes.
  pendingOperations.set(
    vault,
    next.catch(() => undefined)
  );
  return next;
}

export function resolveMovedFocusFilePath(vault: Vault, path: string): string {
  return movedPaths.get(vault)?.get(path) ?? path;
}

export function recordFocusFileMove(vault: Vault, source: string, destination: string): void {
  const paths = movedPaths.get(vault) ?? new Map<string, string>();
  for (const [alias, target] of paths) {
    if (target === source) paths.set(alias, destination);
  }
  paths.delete(destination);
  paths.set(source, destination);
  movedPaths.set(vault, paths);
}

export function selectFocusFilePath(vault: Vault, path: string): void {
  // Explicitly selecting a former location uses that file, not an old redirect.
  movedPaths.get(vault)?.delete(path);
}
