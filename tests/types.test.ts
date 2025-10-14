import { HotlistItem } from "../src/types";

describe("HotlistItem type", () => {
  it("should have all required properties", () => {
    const item: HotlistItem = {
      file: "Projects/Test.md",
      lineNumber: 5,
      lineContent: "- [ ] Test action",
      text: "Test action",
      sphere: "work",
      isGeneral: false,
      addedAt: Date.now(),
    };

    expect(item.file).toBe("Projects/Test.md");
    expect(item.lineNumber).toBe(5);
    expect(item.lineContent).toBe("- [ ] Test action");
    expect(item.text).toBe("Test action");
    expect(item.sphere).toBe("work");
    expect(item.isGeneral).toBe(false);
    expect(typeof item.addedAt).toBe("number");
  });
});
