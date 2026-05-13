// ABOUTME: Centralizes Obsidian active window/document access for popout compatibility.
// ABOUTME: Provides DOM, timer, and window helpers with safe test fallbacks.

import type { Workspace, WorkspaceLeaf } from "obsidian";

export type TimerHandle = number;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function getWindowDocument(): Document | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const documentKey = "document" as keyof Window;
  return window.activeDocument ?? (window[documentKey] as Document | undefined);
}

function getWindowActiveTarget(): Window | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.activeWindow ?? window;
}

function getOptionalActiveWindow(owner?: Node | null): Window | undefined {
  if (owner?.ownerDocument?.defaultView) {
    return owner.ownerDocument.defaultView;
  }

  const focusedWindow =
    typeof activeWindow === "undefined" ? getWindowActiveTarget() : activeWindow;
  if (focusedWindow) {
    return focusedWindow;
  }

  const focusedDocument =
    typeof activeDocument === "undefined" ? getWindowDocument() : activeDocument;
  return focusedDocument?.defaultView ?? undefined;
}

export function getActiveDocument(): Document {
  const focusedDocument =
    typeof activeDocument === "undefined" ? getWindowDocument() : activeDocument;

  if (focusedDocument) {
    return focusedDocument;
  }

  throw new Error("No active Document is available");
}

export function getActiveWindow(): Window {
  const focusedWindow =
    typeof activeWindow === "undefined" ? getWindowActiveTarget() : activeWindow;

  if (focusedWindow) {
    return focusedWindow;
  }

  const focusedDocument =
    typeof activeDocument === "undefined" ? getWindowDocument() : activeDocument;
  if (focusedDocument?.defaultView) {
    return focusedDocument.defaultView;
  }

  throw new Error("No active window is available");
}

export function getDocumentForOwner(owner?: Node | null): Document {
  return owner?.ownerDocument ?? getActiveDocument();
}

export function getWindowForOwner(owner?: Node | null): Window {
  return getDocumentForOwner(owner).defaultView ?? getActiveWindow();
}

export function createElementForOwner<K extends keyof HTMLElementTagNameMap>(
  owner: Node | null | undefined,
  tagName: K
): HTMLElementTagNameMap[K] {
  return getDocumentForOwner(owner).createElement(tagName);
}

export function createSvgElementForOwner<K extends keyof SVGElementTagNameMap>(
  owner: Node | null | undefined,
  tagName: K
): SVGElementTagNameMap[K] {
  return getDocumentForOwner(owner).createElementNS(SVG_NAMESPACE, tagName);
}

export function ownerDocumentContains(owner: Node): boolean {
  return getDocumentForOwner(owner).body.contains(owner);
}

export function setActiveTimeout(
  callback: () => void,
  delayMs: number,
  owner?: Node | null
): TimerHandle {
  return (
    getOptionalActiveWindow(owner)?.setTimeout(callback, delayMs) ??
    window.setTimeout(callback, delayMs)
  );
}

export function clearActiveTimeout(handle: TimerHandle, owner?: Node | null): void {
  const ownerWindow = getOptionalActiveWindow(owner);
  if (ownerWindow) {
    ownerWindow.clearTimeout(handle);
    return;
  }

  window.clearTimeout(handle);
}

export function setActiveInterval(
  callback: () => void,
  delayMs: number,
  owner?: Node | null
): TimerHandle {
  return (
    getOptionalActiveWindow(owner)?.setInterval(callback, delayMs) ??
    window.setInterval(callback, delayMs)
  );
}

export function clearActiveInterval(handle: TimerHandle, owner?: Node | null): void {
  const ownerWindow = getOptionalActiveWindow(owner);
  if (ownerWindow) {
    ownerWindow.clearInterval(handle);
    return;
  }

  window.clearInterval(handle);
}

export function requestActiveAnimationFrame(
  callback: FrameRequestCallback,
  owner?: Node | null
): number {
  const ownerWindow = getOptionalActiveWindow(owner);
  if (typeof ownerWindow?.requestAnimationFrame === "function") {
    return ownerWindow.requestAnimationFrame(callback);
  }

  return (
    ownerWindow?.setTimeout(() => callback(Date.now()), 0) ??
    window.setTimeout(() => callback(Date.now()), 0)
  );
}

export function openInActiveWindow(url: string, target?: string): void {
  getActiveWindow().open(url, target);
}

export async function revealLeaf(workspace: Workspace, leaf: WorkspaceLeaf): Promise<void> {
  await workspace.revealLeaf(leaf);
}

export function setActiveLeaf(
  workspace: Workspace,
  leaf: WorkspaceLeaf,
  params?: { focus?: boolean }
): void {
  workspace.setActiveLeaf(leaf, params);
}
