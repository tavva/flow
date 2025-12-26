// ABOUTME: Tests for KeyboardShortcutsModal
// ABOUTME: Verifies the keyboard shortcuts help popup displays correctly

import { App } from "obsidian";
import { KeyboardShortcutsModal } from "../src/keyboard-shortcuts-modal";

describe("KeyboardShortcutsModal", () => {
  let mockApp: App;
  let modal: KeyboardShortcutsModal;

  beforeEach(() => {
    mockApp = new App();
    modal = new KeyboardShortcutsModal(mockApp);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("onOpen", () => {
    it("should render a title", () => {
      modal.onOpen();

      const contentEl = (modal as any).contentEl;
      const heading = contentEl.querySelector("h2");
      expect(heading).toBeTruthy();
      expect(heading.textContent).toBe("Keyboard shortcuts");
    });

    it("should display all keyboard shortcuts", () => {
      modal.onOpen();

      const contentEl = (modal as any).contentEl;
      const kbdElements = contentEl.querySelectorAll("kbd");
      const keys = Array.from(kbdElements).map((kbd: Element) => kbd.textContent);

      // Check for key shortcuts
      expect(keys).toContain("N");
      expect(keys).toContain("S");
      expect(keys).toContain("R");
      expect(keys).toContain("Enter");
      expect(keys).toContain("←");
      expect(keys).toContain("→");
    });

    it("should display shortcut descriptions", () => {
      modal.onOpen();

      const contentEl = (modal as any).contentEl;
      const text = contentEl.textContent;

      expect(text).toContain("Next Actions");
      expect(text).toContain("Someday/Maybe");
      expect(text).toContain("Reference");
      expect(text).toContain("Save");
    });

    it("should include modifier keys in descriptions", () => {
      modal.onOpen();

      const contentEl = (modal as any).contentEl;
      const kbdElements = contentEl.querySelectorAll("kbd");
      const keys = Array.from(kbdElements).map((kbd: Element) => kbd.textContent);

      // Should include Ctrl modifier (Platform.isMacOS is false in tests)
      expect(keys).toContain("Ctrl");
    });

    it("should group shortcuts by category", () => {
      modal.onOpen();

      const contentEl = (modal as any).contentEl;
      const groupTitles = contentEl.querySelectorAll(".flow-shortcuts-group-title");

      expect(groupTitles.length).toBe(3);
      const titles = Array.from(groupTitles).map((el: Element) => el.textContent);
      expect(titles).toContain("Quick categorise");
      expect(titles).toContain("Navigation");
      expect(titles).toContain("Actions");
    });
  });

  describe("onClose", () => {
    it("should empty the content element on close", () => {
      modal.onOpen();
      modal.onClose();

      const contentEl = (modal as any).contentEl;
      expect(contentEl.children.length).toBe(0);
    });
  });
});
