// ABOUTME: Tests the Focus API for other plugins against an in-memory vault and real persistence.
// ABOUTME: Covers adding, changing, completing and removing items, and change events.

import { TFile, Vault } from "obsidian";
import { ExternalFocusItem, FocusItem, PluginSettings, VaultFocusItem } from "../src/types";
import { DEFAULT_SETTINGS } from "../src/types/settings";
import { ValidationError } from "../src/errors";
import { FocusApi, FocusChange, diffExternalFocusItems } from "../src/focus-api";
import { updateFocusItems } from "../src/focus-persistence";

jest.mock("obsidian");

const FOCUS_PATH = "flow-focus-data/focus.md";

const vaultItem = (text: string): VaultFocusItem => ({
  file: "Projects/Plan.md",
  lineNumber: 5,
  lineContent: `- [ ] ${text}`,
  text,
  sphere: "work",
  isGeneral: false,
  addedAt: 1,
  contexts: [],
});

const externalItem = (
  id: string,
  overrides: Partial<ExternalFocusItem> = {},
  sourceName = "linear"
): ExternalFocusItem => ({
  id,
  text: `Ticket ${id}`,
  sphere: "work",
  addedAt: 2,
  external: {
    sourceName,
    sourceLabel: "Acme",
    url: `https://linear.app/acme/issue/${id}`,
    externalId: id,
  },
  contexts: [],
  ...overrides,
});

const newTicket = {
  text: "Draft section 2 of the onboarding guide",
  sphere: "work",
  sourceName: "linear",
  sourceLabel: "Acme",
  url: "https://linear.app/acme/issue/ABC-123/onboarding-guide",
  externalId: "ABC-123",
};

// A vault of focus files, written through the real persistence code
function createVault(initial: FocusItem[] = []) {
  const toJsonl = (items: FocusItem[]) => items.map((item) => JSON.stringify(item)).join("\n");
  const files = new Map<string, string>([[FOCUS_PATH, toJsonl(initial)]]);
  const vault = {
    getAbstractFileByPath: jest.fn((path: string) => (files.has(path) ? new TFile(path) : null)),
    read: jest.fn(async (file: TFile) => files.get(file.path) ?? ""),
    modify: jest.fn(async (file: TFile, value: string) => {
      files.set(file.path, value);
    }),
    adapter: { stat: jest.fn(async () => ({ type: "folder" })) },
  } as unknown as Vault;
  return {
    vault,
    items: (path = FOCUS_PATH) =>
      (files.get(path) ?? "")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as FocusItem),
    // Stands in for a change synced from another device
    replaceContent: (items: FocusItem[], path = FOCUS_PATH) => {
      files.set(path, toJsonl(items));
    },
  };
}

const SETTLE_MS = 20;
const waitToSettle = () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS * 3));

async function createApi(initial: FocusItem[] = []) {
  const store = createVault(initial);
  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    spheres: ["personal", "work"],
    focusFilePath: FOCUS_PATH,
  };
  const api = new FocusApi(store.vault, () => settings, SETTLE_MS);
  await api.checkForChanges();
  return { api, settings, ...store };
}

function recordChanges(api: FocusApi, sourceName = "linear") {
  const changes: FocusChange[] = [];
  api.onFocusChange(sourceName, (change) => changes.push(change));
  return changes;
}

describe("diffExternalFocusItems", () => {
  it("reports added and removed items", () => {
    const kept = externalItem("ABC-1");
    const gone = externalItem("ABC-2");
    const added = externalItem("ABC-3");

    expect(diffExternalFocusItems([kept, gone], [kept, added])).toEqual([
      { type: "added", item: added },
      { type: "removed", item: gone },
    ]);
  });

  it("reports a newly completed item", () => {
    const before = externalItem("ABC-1");
    const after = { ...before, completedAt: 100 };

    expect(diffExternalFocusItems([before], [after])).toEqual([{ type: "completed", item: after }]);
  });

  it("does not report an item that was already completed", () => {
    const before = externalItem("ABC-1", { completedAt: 100 });

    expect(diffExternalFocusItems([before], [{ ...before }])).toEqual([]);
  });

  it.each([
    ["text", { text: "New wording" }],
    ["sphere", { sphere: "personal" }],
  ])("reports a change of %s as an edit", (_field, overrides) => {
    const before = externalItem("ABC-1");
    const after = { ...before, ...overrides };

    expect(diffExternalFocusItems([before], [after])).toEqual([
      { type: "edited", item: after, previous: before },
    ]);
  });

  it.each([
    ["sourceLabel", { sourceLabel: "Abacus" }],
    ["url", { url: "https://linear.app/abacus/issue/ABC-1" }],
    ["externalId", { externalId: "XYZ-12" }],
  ])("reports a change of %s as an edit", (_field, sourceChanges) => {
    const before = externalItem("ABC-1");
    const after = { ...before, external: { ...before.external, ...sourceChanges } };

    expect(diffExternalFocusItems([before], [after])).toEqual([
      { type: "edited", item: after, previous: before },
    ]);
  });

  it("ignores pinning and reordering", () => {
    const first = externalItem("ABC-1");
    const second = externalItem("ABC-2");

    expect(diffExternalFocusItems([first, second], [{ ...second, isPinned: true }, first])).toEqual(
      []
    );
  });

  it("ignores vault items", () => {
    expect(diffExternalFocusItems([vaultItem("Old")], [vaultItem("New")])).toEqual([]);
  });

  it("reports an item completed and edited in one change", () => {
    const before = externalItem("ABC-1");
    const after = { ...before, text: "New wording", completedAt: 100 };

    expect(diffExternalFocusItems([before], [after])).toEqual([
      { type: "edited", item: after, previous: before },
      { type: "completed", item: after },
    ]);
  });
});

describe("FocusApi", () => {
  it("has API version 1", async () => {
    const { api } = await createApi();
    expect(api.apiVersion).toBe(1);
  });

  describe("addFocusItem", () => {
    it("appends an external item after existing items and returns its id", async () => {
      const existing = vaultItem("Existing action");
      const { api, items } = await createApi([existing]);

      const id = await api.addFocusItem(newTicket);

      expect(items()).toEqual([
        existing,
        {
          id,
          text: newTicket.text,
          sphere: "work",
          addedAt: expect.any(Number),
          external: {
            sourceName: "linear",
            sourceLabel: "Acme",
            url: newTicket.url,
            externalId: "ABC-123",
          },
          contexts: [],
        },
      ]);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("gives each item its own id, even for the same outside record", async () => {
      const { api, items } = await createApi();

      const first = await api.addFocusItem(newTicket);
      const second = await api.addFocusItem({ ...newTicket, text: "Review section 2" });

      expect(first).not.toBe(second);
      expect(items().map((item) => item.text)).toEqual([newTicket.text, "Review section 2"]);
    });

    it.each(["text", "sphere", "sourceName", "sourceLabel", "externalId"] as const)(
      "rejects an empty %s and writes nothing",
      async (field) => {
        const { api, items, vault } = await createApi();

        await expect(api.addFocusItem({ ...newTicket, [field]: "  " })).rejects.toThrow(
          new ValidationError(`Focus item ${field} must not be empty`)
        );
        expect(items()).toEqual([]);
        expect(vault.modify).not.toHaveBeenCalled();
      }
    );

    it.each(["javascript:alert(1)", "file:///etc/passwd", "not a url", ""])(
      "rejects the url %p and writes nothing",
      async (url) => {
        const { api, items } = await createApi();

        await expect(api.addFocusItem({ ...newTicket, url })).rejects.toThrow(
          new ValidationError("Focus item url must be an http or https link")
        );
        expect(items()).toEqual([]);
      }
    );

    it("accepts an http link", async () => {
      const { api, items } = await createApi();

      await api.addFocusItem({ ...newTicket, url: "http://localhost:8080/issue/1" });

      expect(items()).toHaveLength(1);
    });
  });

  describe("updateFocusItem", () => {
    it("changes only the given fields", async () => {
      const item = externalItem("ABC-1");
      const { api, items } = await createApi([item]);

      await api.updateFocusItem("ABC-1", { text: "New wording", url: "https://example.com/1" });

      expect(items()).toEqual([
        {
          ...item,
          text: "New wording",
          external: { ...item.external, url: "https://example.com/1" },
        },
      ]);
    });

    it("changes the sphere and source label", async () => {
      const item = externalItem("ABC-1");
      const { api, items } = await createApi([item]);

      await api.updateFocusItem("ABC-1", { sphere: "personal", sourceLabel: "Abacus" });

      expect(items()).toEqual([
        { ...item, sphere: "personal", external: { ...item.external, sourceLabel: "Abacus" } },
      ]);
    });

    it("changes the external ID", async () => {
      const item = externalItem("ABC-1");
      const { api, items } = await createApi([item]);

      await api.updateFocusItem("ABC-1", { externalId: "XYZ-12" });

      expect(items()).toEqual([{ ...item, external: { ...item.external, externalId: "XYZ-12" } }]);
    });

    it("rejects an unknown id", async () => {
      const { api } = await createApi([externalItem("ABC-1")]);

      await expect(api.updateFocusItem("missing", { text: "New" })).rejects.toThrow(
        new ValidationError("No Focus item with id missing")
      );
    });

    it("rejects a url that isn't an http or https link", async () => {
      const item = externalItem("ABC-1");
      const { api, items } = await createApi([item]);

      await expect(api.updateFocusItem("ABC-1", { url: "javascript:alert(1)" })).rejects.toThrow(
        ValidationError
      );
      expect(items()).toEqual([item]);
    });

    it.each(["text", "sphere", "sourceLabel", "externalId"] as const)(
      "rejects an empty %s",
      async (field) => {
        const item = externalItem("ABC-1");
        const { api, items } = await createApi([item]);

        await expect(api.updateFocusItem("ABC-1", { [field]: "" })).rejects.toThrow(
          ValidationError
        );
        expect(items()).toEqual([item]);
      }
    );
  });

  describe("completeFocusItem", () => {
    it("sets completedAt and keeps the item in Focus", async () => {
      const item = externalItem("ABC-1");
      const { api, items } = await createApi([item]);

      await api.completeFocusItem("ABC-1");

      expect(items()).toEqual([{ ...item, completedAt: expect.any(Number) }]);
    });

    it("keeps the first completion time when completed again", async () => {
      const item = externalItem("ABC-1", { completedAt: 100 });
      const { api, items } = await createApi([item]);

      await api.completeFocusItem("ABC-1");

      expect(items()).toEqual([item]);
    });

    it("rejects an unknown id", async () => {
      const { api } = await createApi();

      await expect(api.completeFocusItem("missing")).rejects.toThrow(ValidationError);
    });
  });

  describe("removeFocusItem", () => {
    it("removes only that item", async () => {
      const kept = vaultItem("Keep me");
      const { api, items } = await createApi([kept, externalItem("ABC-1")]);

      await api.removeFocusItem("ABC-1");

      expect(items()).toEqual([kept]);
    });

    it("rejects an unknown id", async () => {
      const { api } = await createApi();

      await expect(api.removeFocusItem("missing")).rejects.toThrow(ValidationError);
    });
  });

  it("never treats a vault item as an external item with that id", async () => {
    const { api } = await createApi([vaultItem("Projects/Plan.md")]);

    await expect(api.removeFocusItem("Projects/Plan.md")).rejects.toThrow(ValidationError);
  });

  it("returns the external items for one source, including completed ones", async () => {
    const linear = externalItem("ABC-1");
    const done = externalItem("ABC-2", { completedAt: 100 });
    const github = externalItem("GH-1", {}, "github");
    const { api } = await createApi([vaultItem("Vault"), linear, github, done]);

    expect(await api.getFocusItems("linear")).toEqual([linear, done]);
  });

  it("returns a copy of the configured spheres", async () => {
    const { api, settings } = await createApi();

    const spheres = api.getSpheres();
    spheres.push("changed");

    expect(api.getSpheres()).toEqual(["personal", "work"]);
    expect(settings.spheres).toEqual(["personal", "work"]);
  });

  it("keeps both changes when the API and another writer update Focus at once", async () => {
    const { api, vault, items } = await createApi([externalItem("ABC-1")]);

    await Promise.all([
      api.addFocusItem(newTicket),
      updateFocusItems(vault, (current) => [...current, vaultItem("From the view")], FOCUS_PATH),
      api.completeFocusItem("ABC-1"),
    ]);

    expect(items().map((item) => item.text)).toEqual([
      "Ticket ABC-1",
      newTicket.text,
      "From the view",
    ]);
    expect(items()[0].completedAt).toEqual(expect.any(Number));
  });

  describe("change events", () => {
    it("reports each API change once to the source that owns the item", async () => {
      const { api } = await createApi();
      const linearChanges = recordChanges(api, "linear");
      const githubChanges = recordChanges(api, "github");

      const id = await api.addFocusItem(newTicket);
      await api.updateFocusItem(id, { text: "New wording" });
      await api.completeFocusItem(id);
      await api.removeFocusItem(id);

      expect(linearChanges.map((change) => change.type)).toEqual([
        "added",
        "edited",
        "completed",
        "removed",
      ]);
      expect(linearChanges[1]).toEqual({
        type: "edited",
        item: expect.objectContaining({ id, text: "New wording" }),
        previous: expect.objectContaining({ id, text: newTicket.text }),
      });
      expect(githubChanges).toEqual([]);
    });

    it("reports changes written directly to the file, such as sync", async () => {
      const item = externalItem("ABC-1");
      const { api, replaceContent } = await createApi([item]);
      const changes = recordChanges(api);

      replaceContent([{ ...item, completedAt: 100 }]);
      await api.checkForChanges();

      expect(changes).toEqual([{ type: "completed", item: { ...item, completedAt: 100 } }]);
    });

    it("reports nothing for the state at startup or when nothing changed", async () => {
      const { api } = await createApi([externalItem("ABC-1")]);
      const changes = recordChanges(api);

      await api.checkForChanges();

      expect(changes).toEqual([]);
    });

    it("reports each change once when checks overlap", async () => {
      const { api, replaceContent } = await createApi();
      const changes = recordChanges(api);

      replaceContent([externalItem("ABC-1")]);
      await Promise.all([api.checkForChanges(), api.checkForChanges(), api.checkForChanges()]);

      expect(changes.map((change) => change.type)).toEqual(["added"]);
    });

    it("stops calling a callback after it unsubscribes", async () => {
      const { api } = await createApi();
      const callback = jest.fn();
      const unsubscribe = api.onFocusChange("linear", callback);

      unsubscribe();
      await api.addFocusItem(newTicket);

      expect(callback).not.toHaveBeenCalled();
    });

    it("forgets a source once its last callback unsubscribes", async () => {
      const { api } = await createApi();
      const unsubscribeFirst = api.onFocusChange("linear", jest.fn());
      const unsubscribeSecond = api.onFocusChange("linear", jest.fn());

      unsubscribeFirst();
      expect((api as any).callbacks.has("linear")).toBe(true);
      unsubscribeSecond();
      expect((api as any).callbacks.has("linear")).toBe(false);
    });

    it("gives each callback its own copy of the change", async () => {
      const item = externalItem("ABC-1");
      const { api, replaceContent } = await createApi([item]);
      const seen: string[] = [];
      api.onFocusChange("linear", (change) => {
        change.item.text = "Changed by a callback";
      });
      api.onFocusChange("linear", (change) => seen.push(change.item.text));

      replaceContent([{ ...item, text: "Synced wording" }]);
      await api.checkForChanges();
      await api.checkForChanges();

      expect(seen).toEqual(["Synced wording"]);
    });

    it("returns items the caller can change without affecting later events", async () => {
      const item = externalItem("ABC-1");
      const { api } = await createApi([item]);
      const changes = recordChanges(api);

      const [returned] = await api.getFocusItems("linear");
      returned.text = "Changed by the caller";
      await api.checkForChanges();

      expect(changes).toEqual([]);
    });

    it("resolves a write that succeeded even if the change check then fails", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
      const { api, items } = await createApi();
      const failure = new Error("Read failed");
      jest.spyOn(api, "checkForChanges").mockRejectedValueOnce(failure);

      await expect(api.addFocusItem(newTicket)).resolves.toEqual(expect.any(String));

      expect(items()).toHaveLength(1);
      expect(consoleError).toHaveBeenCalledWith("Failed to check focus file for changes", failure);
      consoleError.mockRestore();
    });

    it("reports nothing when the focus file setting points at a different file", async () => {
      const { api, settings, replaceContent } = await createApi([externalItem("ABC-1")]);
      const changes = recordChanges(api);
      replaceContent([externalItem("ABC-9")], "Other/Focus.md");

      settings.focusFilePath = "Other/Focus.md";
      await api.checkForChanges();
      expect(changes).toEqual([]);

      replaceContent([externalItem("ABC-9"), externalItem("ABC-10")], "Other/Focus.md");
      await api.checkForChanges();
      expect(changes).toEqual([{ type: "added", item: externalItem("ABC-10") }]);
    });

    it("waits for the file to settle, so a passing half-synced state reports nothing", async () => {
      const item = externalItem("ABC-1");
      const { api, replaceContent } = await createApi([item]);
      const changes = recordChanges(api);
      const check = jest.spyOn(api, "checkForChanges");

      replaceContent([]); // Sync empties the file for a moment
      api.checkForChangesWhenSettled();
      replaceContent([{ ...item, text: "Synced wording" }]);
      api.checkForChangesWhenSettled();
      await waitToSettle();
      await api.checkForChanges();

      expect(check).toHaveBeenCalledTimes(2); // One settled check, then the one above
      expect(changes).toEqual([
        { type: "edited", item: { ...item, text: "Synced wording" }, previous: item },
      ]);
    });

    it("logs a failed settled check", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
      const { api, vault } = await createApi();
      const failure = new Error("Read failed");
      (vault.read as jest.Mock).mockRejectedValueOnce(failure);

      api.checkForChangesWhenSettled();
      await waitToSettle();

      expect(consoleError).toHaveBeenCalledWith("Failed to check focus file for changes", failure);
      consoleError.mockRestore();
    });
  });

  describe("after Flow unloads", () => {
    it("stops calling callbacks and cancels a waiting check", async () => {
      const { api, replaceContent } = await createApi();
      const callback = jest.fn();
      api.onFocusChange("linear", callback);
      replaceContent([externalItem("ABC-1")]);
      api.checkForChangesWhenSettled();

      api.dispose();
      await waitToSettle();
      await api.checkForChanges();

      expect(callback).not.toHaveBeenCalled();
    });

    it("refuses writes and new callbacks", async () => {
      const { api, items } = await createApi([externalItem("ABC-1")]);
      api.dispose();

      await expect(api.addFocusItem(newTicket)).rejects.toThrow("Flow has been unloaded");
      await expect(api.completeFocusItem("ABC-1")).rejects.toThrow("Flow has been unloaded");
      const callback = jest.fn();
      api.onFocusChange("linear", callback)();
      expect((api as any).callbacks.size).toBe(0);
      expect(items()).toEqual([externalItem("ABC-1")]);
    });

    it("logs a throwing callback and still calls the others", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
      const { api } = await createApi();
      const failure = new Error("Callback broke");
      api.onFocusChange("linear", () => {
        throw failure;
      });
      const changes = recordChanges(api);

      await api.addFocusItem(newTicket);

      expect(changes.map((change) => change.type)).toEqual(["added"]);
      expect(consoleError).toHaveBeenCalledWith("Focus change callback failed", failure);
      consoleError.mockRestore();
    });

    it("keeps checking after a failed read", async () => {
      const { api, vault, replaceContent } = await createApi();
      const changes = recordChanges(api);
      (vault.read as jest.Mock).mockRejectedValueOnce(new Error("Read failed"));

      await expect(api.checkForChanges()).rejects.toThrow("Read failed");
      replaceContent([externalItem("ABC-1")]);
      await api.checkForChanges();

      expect(changes.map((change) => change.type)).toEqual(["added"]);
    });
  });
});
