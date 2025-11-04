import { FlowProject } from "../src/types";

describe("SphereView filtering", () => {
  describe("filterData", () => {
    it("should return all data when query is empty", () => {
      const data = {
        projects: [
          {
            project: {
              title: "Test Project",
              nextActions: ["Action 1", "Action 2"],
              tags: ["project/work"],
              status: "live" as const,
              file: "test.md",
            },
            priority: 1,
            depth: 0,
          },
        ],
        projectsNeedingNextActions: [],
        generalNextActions: ["General action"],
      };

      // Access private method via any cast for testing
      const view = createMockSphereView();
      const result = (view as any).filterData(data, "");

      expect(result).toEqual(data);
    });

    it("should filter projects by action text (case-insensitive)", () => {
      const data = {
        projects: [
          {
            project: {
              title: "Project One",
              nextActions: ["Call dentist", "Email client"],
              tags: ["project/work"],
              status: "live" as const,
              file: "one.md",
            },
            priority: 1,
            depth: 0,
          },
          {
            project: {
              title: "Project Two",
              nextActions: ["Review code", "Write tests"],
              tags: ["project/work"],
              status: "live" as const,
              file: "two.md",
            },
            priority: 2,
            depth: 0,
          },
        ],
        projectsNeedingNextActions: [],
        generalNextActions: [],
      };

      const view = createMockSphereView();
      const result = (view as any).filterData(data, "DENTIST");

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].project.title).toBe("Project One");
      expect(result.projects[0].project.nextActions).toEqual(["Call dentist"]);
    });

    it("should filter projects by project name", () => {
      const data = {
        projects: [
          {
            project: {
              title: "Marketing Campaign",
              nextActions: ["Create landing page"],
              tags: ["project/work"],
              status: "live" as const,
              file: "marketing.md",
            },
            priority: 1,
            depth: 0,
          },
          {
            project: {
              title: "Engineering Sprint",
              nextActions: ["Fix bug"],
              tags: ["project/work"],
              status: "live" as const,
              file: "engineering.md",
            },
            priority: 2,
            depth: 0,
          },
        ],
        projectsNeedingNextActions: [],
        generalNextActions: [],
      };

      const view = createMockSphereView();
      const result = (view as any).filterData(data, "marketing");

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].project.title).toBe("Marketing Campaign");
    });

    it("should show all actions when project name matches", () => {
      const data = {
        projects: [
          {
            project: {
              title: "Marketing Campaign",
              nextActions: ["Write blog", "Design logo", "Launch ad"],
              tags: ["project/work"],
              status: "live" as const,
              file: "marketing.md",
            },
            priority: 1,
            depth: 0,
          },
        ],
        projectsNeedingNextActions: [],
        generalNextActions: [],
      };

      const view = createMockSphereView();
      const result = (view as any).filterData(data, "marketing");

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].project.nextActions).toHaveLength(3);
      expect(result.projects[0].project.nextActions).toEqual([
        "Write blog",
        "Design logo",
        "Launch ad",
      ]);
    });

    it("should filter general actions", () => {
      const data = {
        projects: [],
        projectsNeedingNextActions: [],
        generalNextActions: ["Buy groceries", "Call dentist", "Review email"],
      };

      const view = createMockSphereView();
      const result = (view as any).filterData(data, "dentist");

      expect(result.generalNextActions).toEqual(["Call dentist"]);
    });

    it("should not filter projectsNeedingNextActions", () => {
      const needsActions = [
        {
          project: {
            title: "Empty Project",
            nextActions: [],
            tags: ["project/work"],
            status: "live" as const,
            file: "empty.md",
          },
          priority: 1,
          depth: 0,
        },
      ];

      const data = {
        projects: [],
        projectsNeedingNextActions: needsActions,
        generalNextActions: [],
      };

      const view = createMockSphereView();
      const result = (view as any).filterData(data, "something");

      expect(result.projectsNeedingNextActions).toEqual(needsActions);
    });
  });

  describe("Search UI rendering", () => {
    it("should render sticky header with search input", () => {
      const { SphereView } = require("../src/sphere-view");
      const view = createMockSphereView();

      // Mock container element
      const headerEl = createMockContainerElement();
      const searchInput = createMockInputElement();
      const clearButton = createMockElement();

      let capturedSearchInput: any;
      let capturedClearButton: any;

      headerEl.createDiv = jest.fn((opts: any) => {
        if (opts?.cls === "flow-gtd-sphere-sticky-header") {
          const header = createMockElement();
          header.createEl = jest.fn((tag: string, opts: any) => {
            if (tag === "h2" && opts?.cls === "flow-gtd-sphere-title") {
              return { setText: jest.fn() };
            }
            if (tag === "input" && opts?.cls === "flow-gtd-sphere-search-input") {
              searchInput.placeholder = opts?.placeholder || "";
              searchInput.value = opts?.value || "";
              capturedSearchInput = searchInput;
              return searchInput;
            }
            if (tag === "span" && opts?.cls === "flow-gtd-sphere-search-clear") {
              capturedClearButton = clearButton;
              return clearButton;
            }
            if (tag === "button" && opts?.cls === "flow-gtd-sphere-actions-toggle") {
              const toggleBtn = createMockElement();
              toggleBtn.setText = jest.fn();
              return toggleBtn;
            }
            return createMockElement();
          });
          header.createDiv = jest.fn((divOpts: any) => {
            if (divOpts?.cls === "flow-gtd-sphere-controls-row") {
              const controlsRow = createMockElement();
              controlsRow.createEl = header.createEl;
              controlsRow.createDiv = jest.fn((containerOpts: any) => {
                if (containerOpts?.cls === "flow-gtd-sphere-search-container") {
                  const searchContainer = createMockElement();
                  searchContainer.createEl = header.createEl;
                  return searchContainer;
                }
                return createMockElement();
              });
              return controlsRow;
            }
            return createMockElement();
          });
          return header;
        }
        return createMockElement();
      });

      const data = {
        projects: [],
        projectsNeedingNextActions: [],
        generalNextActions: [],
      };

      (view as any).renderContent(headerEl, data);

      expect(headerEl.createDiv).toHaveBeenCalledWith({ cls: "flow-gtd-sphere-sticky-header" });
      expect(capturedSearchInput).toBeTruthy();
      expect(capturedSearchInput.placeholder).toBe("Filter actions and projects...");
      expect(capturedClearButton).toBeTruthy();
    });

    it("should hide clear button when query is empty", () => {
      const { SphereView } = require("../src/sphere-view");
      const view = createMockSphereView();

      const headerEl = createMockContainerElement();
      const clearButton = createMockElement();
      clearButton.style = { display: "" };

      headerEl.createDiv = jest.fn((opts: any) => {
        if (opts?.cls === "flow-gtd-sphere-sticky-header") {
          const header = createMockElement();
          header.createEl = jest.fn((tag: string, opts: any) => {
            if (tag === "span" && opts?.cls === "flow-gtd-sphere-search-clear") {
              return clearButton;
            }
            if (tag === "input") {
              return createMockInputElement();
            }
            if (tag === "button" && opts?.cls === "flow-gtd-sphere-actions-toggle") {
              const toggleBtn = createMockElement();
              toggleBtn.setText = jest.fn();
              return toggleBtn;
            }
            return createMockElement();
          });
          header.createDiv = jest.fn((divOpts: any) => {
            if (divOpts?.cls === "flow-gtd-sphere-controls-row") {
              const controlsRow = createMockElement();
              controlsRow.createEl = header.createEl;
              controlsRow.createDiv = jest.fn((containerOpts: any) => {
                if (containerOpts?.cls === "flow-gtd-sphere-search-container") {
                  const searchContainer = createMockElement();
                  searchContainer.createEl = header.createEl;
                  return searchContainer;
                }
                return createMockElement();
              });
              return controlsRow;
            }
            return createMockElement();
          });
          return header;
        }
        return createMockElement();
      });

      (view as any).searchQuery = "";
      (view as any).renderContent(headerEl, {
        projects: [],
        projectsNeedingNextActions: [],
        generalNextActions: [],
      });

      expect(clearButton.style.display).toBe("none");
    });

    it("should show clear button when query is non-empty", () => {
      const { SphereView } = require("../src/sphere-view");
      const view = createMockSphereView();

      const headerEl = createMockContainerElement();
      const clearButton = createMockElement();
      clearButton.style = { display: "none" };

      headerEl.createDiv = jest.fn((opts: any) => {
        if (opts?.cls === "flow-gtd-sphere-sticky-header") {
          const header = createMockElement();
          header.createEl = jest.fn((tag: string, opts: any) => {
            if (tag === "span" && opts?.cls === "flow-gtd-sphere-search-clear") {
              return clearButton;
            }
            if (tag === "input") {
              const input = createMockInputElement();
              input.value = "test";
              return input;
            }
            if (tag === "button" && opts?.cls === "flow-gtd-sphere-actions-toggle") {
              const toggleBtn = createMockElement();
              toggleBtn.setText = jest.fn();
              return toggleBtn;
            }
            return createMockElement();
          });
          header.createDiv = jest.fn((divOpts: any) => {
            if (divOpts?.cls === "flow-gtd-sphere-controls-row") {
              const controlsRow = createMockElement();
              controlsRow.createEl = header.createEl;
              controlsRow.createDiv = jest.fn((containerOpts: any) => {
                if (containerOpts?.cls === "flow-gtd-sphere-search-container") {
                  const searchContainer = createMockElement();
                  searchContainer.createEl = header.createEl;
                  return searchContainer;
                }
                return createMockElement();
              });
              return controlsRow;
            }
            return createMockElement();
          });
          return header;
        }
        return createMockElement();
      });

      (view as any).searchQuery = "test";
      (view as any).renderContent(headerEl, {
        projects: [],
        projectsNeedingNextActions: [],
        generalNextActions: [],
      });

      expect(clearButton.style.display).toBe("");
    });
  });

  describe("Keyboard shortcuts", () => {
    it("should clear search on Escape", () => {
      const { SphereView } = require("../src/sphere-view");
      const view = createMockSphereView();
      (view as any).searchQuery = "test query";

      const container = createMockContainerElement();
      const searchInput = createMockInputElement();
      const clearButton = createMockElement();
      clearButton.style = { display: "" };

      let inputKeydownHandler: any = null;

      searchInput.addEventListener = jest.fn((event: string, handler: any) => {
        if (event === "keydown") {
          inputKeydownHandler = handler;
        }
      });

      container.createDiv = jest.fn((opts: any) => {
        if (opts?.cls === "flow-gtd-sphere-sticky-header") {
          const header = createMockElement();
          header.createEl = jest.fn((tag: string, opts: any) => {
            if (tag === "input" && opts?.cls === "flow-gtd-sphere-search-input") {
              searchInput.value = "test query";
              return searchInput;
            }
            if (tag === "span" && opts?.cls === "flow-gtd-sphere-search-clear") {
              return clearButton;
            }
            if (tag === "button" && opts?.cls === "flow-gtd-sphere-actions-toggle") {
              const toggleBtn = createMockElement();
              toggleBtn.setText = jest.fn();
              return toggleBtn;
            }
            return createMockElement();
          });
          header.createDiv = jest.fn((divOpts: any) => {
            if (divOpts?.cls === "flow-gtd-sphere-controls-row") {
              const controlsRow = createMockElement();
              controlsRow.createEl = header.createEl;
              controlsRow.createDiv = jest.fn((containerOpts: any) => {
                if (containerOpts?.cls === "flow-gtd-sphere-search-container") {
                  const searchContainer = createMockElement();
                  searchContainer.createEl = header.createEl;
                  return searchContainer;
                }
                return createMockElement();
              });
              return controlsRow;
            }
            return createMockElement();
          });
          return header;
        }
        return createMockElement();
      });

      container.querySelector = jest.fn((selector: string) => {
        if (selector === ".flow-gtd-sphere-search-clear") {
          return clearButton;
        }
        return null;
      });

      (view as any).renderContent(container, {
        projects: [],
        projectsNeedingNextActions: [],
        generalNextActions: [],
      });

      // Verify keyboard handler was registered
      expect(inputKeydownHandler).toBeTruthy();

      // Mock refresh method
      (view as any).refresh = jest.fn();

      // Simulate Escape key
      const escapeEvent = {
        key: "Escape",
      };
      inputKeydownHandler(escapeEvent);

      expect((view as any).searchQuery).toBe("");
      expect(searchInput.value).toBe("");
      expect(clearButton.style.display).toBe("none");
      expect((view as any).refresh).toHaveBeenCalled();
    });
  });
});

// Helper to create mock element
function createMockElement(): any {
  const element: any = {
    createDiv: jest.fn((opts?: any) => {
      const newEl = createMockElement();
      if (opts?.cls) newEl.className = opts.cls;
      return newEl;
    }),
    createEl: jest.fn((tag?: string, opts?: any) => {
      const newEl = createMockElement();
      if (opts?.cls) newEl.className = opts.cls;
      if (opts?.type) newEl.type = opts.type;
      if (opts?.placeholder) newEl.placeholder = opts.placeholder;
      if (opts?.text) newEl.textContent = opts.text;
      return newEl;
    }),
    createSpan: jest.fn((opts?: any) => {
      const newEl = createMockElement();
      if (opts?.cls) newEl.className = opts.cls;
      if (opts?.text) newEl.textContent = opts.text;
      return newEl;
    }),
    setText: jest.fn(),
    addEventListener: jest.fn(),
    style: {},
    empty: jest.fn(),
    value: "",
    placeholder: "",
  };
  return element;
}

// Helper to create mock input element
function createMockInputElement(): any {
  return {
    ...createMockElement(),
    value: "",
    placeholder: "",
    addEventListener: jest.fn(),
    focus: jest.fn(),
  };
}

// Helper to create mock container element
function createMockContainerElement(): any {
  const element = createMockElement();
  element.createDiv = jest.fn((opts?: any) => {
    const newElement = createMockElement();
    newElement.createDiv = jest.fn(() => createMockElement());
    return newElement;
  });
  element.createEl = jest.fn(() => createMockElement());
  element.empty = jest.fn();
  return element;
}

// Helper to create mock SphereView for testing
function createMockSphereView() {
  const mockLeaf = {} as any;
  const mockSettings = {
    nextActionsFilePath: "Next actions.md",
    focus: [],
  } as any;
  const mockSaveSettings = jest.fn();

  // Import SphereView and create instance
  const { SphereView } = require("../src/sphere-view");
  return new SphereView(mockLeaf, "work", mockSettings, mockSaveSettings);
}
