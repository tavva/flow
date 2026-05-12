// ABOUTME: Tests local Dataview API discovery without bundling Dataview itself.
// ABOUTME: Verifies Flow detects optional Dataview plugin availability safely.

import { App } from "obsidian";
import { getDataviewApi } from "../src/dataview-api";

describe("getDataviewApi", () => {
  test("returns the installed Dataview plugin API when it exposes pages", () => {
    const dataviewApi = {
      pages: jest.fn(),
    };
    const app = {
      plugins: {
        plugins: {
          dataview: {
            api: dataviewApi,
          },
        },
      },
    } as unknown as App;

    expect(getDataviewApi(app)).toBe(dataviewApi);
  });

  test("returns null when Dataview is not installed", () => {
    const app = {
      plugins: {
        plugins: {},
      },
    } as unknown as App;

    expect(getDataviewApi(app)).toBeNull();
  });

  test("returns null when the Dataview plugin is present without a usable API", () => {
    const app = {
      plugins: {
        plugins: {
          dataview: {
            api: {},
          },
        },
      },
    } as unknown as App;

    expect(getDataviewApi(app)).toBeNull();
  });
});
