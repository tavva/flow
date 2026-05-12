// ABOUTME: Centralizes Obsidian active window/document access for popout compatibility.
// ABOUTME: Provides DOM, timer, and window helpers with safe test fallbacks.

type ObsidianGlobals = typeof globalThis & {
  activeDocument?: Document;
  activeWindow?: Window;
  document?: Document;
  window?: Window & {
    activeDocument?: Document;
    activeWindow?: Window;
  };
};

export type TimerHandle = number;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function getGlobals(): ObsidianGlobals {
  return globalThis as ObsidianGlobals;
}

export function getActiveDocument(): Document {
  const globals = getGlobals();
  const activeDocument = globals.activeDocument ?? globals.window?.activeDocument;

  if (activeDocument) {
    return activeDocument;
  }
  if (globals.document) {
    return globals.document;
  }

  throw new Error("No active document is available");
}

export function getActiveWindow(): Window {
  const globals = getGlobals();
  const activeWindow = globals.activeWindow ?? globals.window?.activeWindow;

  if (activeWindow) {
    return activeWindow;
  }
  if (globals.window) {
    return globals.window;
  }

  const activeDocument = globals.activeDocument ?? globals.document;
  if (activeDocument?.defaultView) {
    return activeDocument.defaultView;
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
  return getWindowForOwner(owner).setTimeout(callback, delayMs);
}

export function clearActiveTimeout(handle: TimerHandle, owner?: Node | null): void {
  getWindowForOwner(owner).clearTimeout(handle);
}

export function setActiveInterval(
  callback: () => void,
  delayMs: number,
  owner?: Node | null
): TimerHandle {
  return getWindowForOwner(owner).setInterval(callback, delayMs);
}

export function clearActiveInterval(handle: TimerHandle, owner?: Node | null): void {
  getWindowForOwner(owner).clearInterval(handle);
}

export function openInActiveWindow(url: string, target?: string): void {
  getActiveWindow().open(url, target);
}
