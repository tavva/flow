import { CoachProtocolBanner } from "../src/coach-protocol-banner";
import { ReviewProtocol } from "../src/types";

describe("CoachProtocolBanner", () => {
  let banner: CoachProtocolBanner;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    banner = new CoachProtocolBanner();
  });

  describe("render", () => {
    it("should not render if no protocols", () => {
      banner.render(container, []);
      expect(container.children.length).toBe(0);
    });

    it("should render single protocol with simple layout", () => {
      const protocols: ReviewProtocol[] = [
        {
          name: "Weekly Review",
          filename: "weekly.md",
          content: "Test content",
          triggers: [],
        },
      ];

      banner.render(container, protocols);

      expect(container.querySelector(".coach-protocol-banner")).toBeTruthy();
      expect(container.textContent).toContain("Weekly Review is available");
      expect(container.querySelector(".coach-protocol-start")).toBeTruthy();
      expect(container.querySelector(".coach-protocol-dismiss")).toBeTruthy();
    });

    it("should render multiple protocols with bulleted list", () => {
      const protocols: ReviewProtocol[] = [
        {
          name: "Weekly Review",
          filename: "weekly.md",
          content: "Test 1",
          triggers: [],
        },
        {
          name: "Project Review",
          filename: "project.md",
          content: "Test 2",
          triggers: [],
        },
      ];

      banner.render(container, protocols);

      expect(container.textContent).toContain("Reviews available");
      expect(container.querySelectorAll(".coach-protocol-item").length).toBe(2);
      expect(container.querySelectorAll(".coach-protocol-start").length).toBe(2);
    });

    it("should emit start event when protocol selected", () => {
      const protocols: ReviewProtocol[] = [
        {
          name: "Weekly Review",
          filename: "weekly.md",
          content: "Test content",
          triggers: [],
        },
      ];

      let selectedProtocol: ReviewProtocol | null = null;
      banner.render(container, protocols, {
        onStart: (protocol) => {
          selectedProtocol = protocol;
        },
      });

      const startBtn = container.querySelector(".coach-protocol-start") as HTMLButtonElement;
      startBtn?.click();

      expect(selectedProtocol).toEqual(protocols[0]);
    });

    it("should emit dismiss event and hide banner", () => {
      const protocols: ReviewProtocol[] = [
        {
          name: "Weekly Review",
          filename: "weekly.md",
          content: "Test content",
          triggers: [],
        },
      ];

      let dismissed = false;
      banner.render(container, protocols, {
        onDismiss: () => {
          dismissed = true;
        },
      });

      const dismissBtn = container.querySelector(
        ".coach-protocol-dismiss"
      ) as HTMLButtonElement;
      dismissBtn?.click();

      expect(dismissed).toBe(true);
      expect(container.querySelector(".coach-protocol-banner")).toBeNull();
    });
  });
});
