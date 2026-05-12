// ABOUTME: Locates the optional Dataview plugin API without bundling Dataview.
// ABOUTME: Keeps Flow's fast scan path available when Dataview is installed.

import { App } from "obsidian";

export interface DataviewApi {
  pages(): {
    file: {
      tasks: {
        where(predicate: (task: DataviewTask) => boolean): Iterable<DataviewTask>;
      };
    };
  };
}

export interface DataviewTask {
  status: string;
  path: string;
  line: number;
  text: string;
  link: {
    path: string;
  };
}

interface AppWithPlugins extends App {
  plugins?: {
    plugins?: Record<string, { api?: unknown } | undefined>;
  };
}

export function getDataviewApi(app: App): DataviewApi | null {
  const dataviewApi = (app as AppWithPlugins).plugins?.plugins?.dataview?.api;
  if (hasDataviewPages(dataviewApi)) {
    return dataviewApi;
  }

  return null;
}

function hasDataviewPages(api: unknown): api is DataviewApi {
  return typeof (api as { pages?: unknown } | null)?.pages === "function";
}
