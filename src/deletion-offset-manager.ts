import { InboxItem } from "./inbox-scanner";

export class DeletionOffsetManager {
  constructor(private readonly offsets: Map<string, number>) {}

  prepareForDeletion(item: InboxItem): InboxItem {
    if (item.type === "line" && item.sourceFile?.path) {
      const filePath = item.sourceFile.path;
      const priorDeletions = this.offsets.get(filePath) ?? 0;
      const originalLineNumber = item.lineNumber ?? 0;
      const adjustedLineNumber = Math.max(1, originalLineNumber - priorDeletions);

      return {
        ...item,
        lineNumber: adjustedLineNumber,
      };
    }

    return item;
  }

  recordDeletion(item: InboxItem): void {
    if (item.type === "line" && item.sourceFile?.path) {
      const filePath = item.sourceFile.path;
      const priorDeletions = this.offsets.get(filePath) ?? 0;
      this.offsets.set(filePath, priorDeletions + 1);
    }
  }
}
