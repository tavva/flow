// ABOUTME: Tests Obsidian active window/document helper behavior.
// ABOUTME: Verifies popout-aware DOM and timer routing fallbacks.

import { readFileSync } from "fs";
import { join } from "path";

import {
  clearActiveInterval,
  clearActiveTimeout,
  createElementForOwner,
  createSvgElementForOwner,
  getActiveDocument,
  getActiveWindow,
  openInActiveWindow,
  setActiveInterval,
  setActiveTimeout,
} from "../src/obsidian-platform";

describe("obsidian-platform", () => {
  const originalActiveDocument = (globalThis as any).activeDocument;
  const originalActiveWindow = (globalThis as any).activeWindow;
  let iframe: HTMLIFrameElement | null = null;

  afterEach(() => {
    iframe?.remove();
    iframe = null;
    (globalThis as any).activeDocument = originalActiveDocument;
    (globalThis as any).activeWindow = originalActiveWindow;
    jest.restoreAllMocks();
  });

  function createPopoutDocument(): { ownerDocument: Document; ownerWindow: Window } {
    iframe = document.createElement("iframe");
    document.body.appendChild(iframe);

    return {
      ownerDocument: iframe.contentDocument as Document,
      ownerWindow: iframe.contentWindow as Window,
    };
  }

  it("uses Obsidian active globals when available", () => {
    const { ownerDocument: activeDocument, ownerWindow: activeWindow } = createPopoutDocument();

    (globalThis as any).activeDocument = activeDocument;
    (globalThis as any).activeWindow = activeWindow;

    expect(getActiveDocument()).toBe(activeDocument);
    expect(getActiveWindow()).toBe(activeWindow);
  });

  it("falls back to the ambient test document and window", () => {
    (globalThis as any).activeDocument = undefined;
    (globalThis as any).activeWindow = undefined;

    expect(getActiveDocument()).toBe(document);
    expect(getActiveWindow()).toBe(window);
  });

  it("creates HTML and SVG elements in the owner document", () => {
    const { ownerDocument } = createPopoutDocument();
    const owner = ownerDocument.createElement("section");

    const div = createElementForOwner(owner, "div");
    const svg = createSvgElementForOwner(owner, "svg");

    expect(div.ownerDocument).toBe(ownerDocument);
    expect(svg.ownerDocument).toBe(ownerDocument);
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
  });

  it("routes timers through the owner document window", () => {
    const { ownerDocument, ownerWindow } = createPopoutDocument();
    const owner = ownerDocument.createElement("section");
    const timeoutSpy = jest.spyOn(ownerWindow, "setTimeout").mockReturnValue(12);
    const clearTimeoutSpy = jest.spyOn(ownerWindow, "clearTimeout").mockImplementation();
    const intervalSpy = jest.spyOn(ownerWindow, "setInterval").mockReturnValue(34);
    const clearIntervalSpy = jest.spyOn(ownerWindow, "clearInterval").mockImplementation();
    const callback = jest.fn();

    const timeout = setActiveTimeout(callback, 50, owner);
    clearActiveTimeout(timeout, owner);
    const interval = setActiveInterval(callback, 100, owner);
    clearActiveInterval(interval, owner);

    expect(timeoutSpy).toHaveBeenCalledWith(callback, 50);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(12);
    expect(intervalSpy).toHaveBeenCalledWith(callback, 100);
    expect(clearIntervalSpy).toHaveBeenCalledWith(34);
  });

  it("keeps timer fallbacks window-qualified for popout compatibility", () => {
    const source = readFileSync(join(process.cwd(), "src", "obsidian-platform.ts"), "utf8");
    const bareTimerCalls = source
      .split("\n")
      .flatMap((line, index) =>
        /(?<![\w.])(?:setTimeout|clearTimeout|setInterval|clearInterval)\s*\(/.test(line)
          ? [`${index + 1}: ${line.trim()}`]
          : []
      );

    expect(bareTimerCalls).toEqual([]);
  });

  it("opens links through the active window", () => {
    const { ownerWindow: activeWindow } = createPopoutDocument();
    const openSpy = jest.spyOn(activeWindow, "open").mockReturnValue(null);
    (globalThis as any).activeWindow = activeWindow;

    openInActiveWindow("https://openrouter.ai/keys", "_blank");

    expect(openSpy).toHaveBeenCalledWith("https://openrouter.ai/keys", "_blank");
  });
});
