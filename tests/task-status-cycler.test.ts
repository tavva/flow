import { cycleTaskStatus, getTaskStatusAtLine } from "../src/task-status-cycler";

describe("Task Status Cycler", () => {
  describe("getTaskStatusAtLine", () => {
    test("should detect unchecked task", () => {
      const line = "- [ ] Do something";
      expect(getTaskStatusAtLine(line)).toBe("todo");
    });

    test("should detect waiting-for task", () => {
      const line = "- [w] Wait for John";
      expect(getTaskStatusAtLine(line)).toBe("waiting");
    });

    test("should detect completed task", () => {
      const line = "- [x] Done task";
      expect(getTaskStatusAtLine(line)).toBe("done");
    });

    test("should detect completed task with capital X", () => {
      const line = "- [X] Done task";
      expect(getTaskStatusAtLine(line)).toBe("done");
    });

    test("should return null for non-task line", () => {
      const line = "Just regular text";
      expect(getTaskStatusAtLine(line)).toBeNull();
    });

    test("should handle asterisk bullets", () => {
      const line = "* [w] Wait for response";
      expect(getTaskStatusAtLine(line)).toBe("waiting");
    });
  });

  describe("cycleTaskStatus", () => {
    test("should cycle todo -> waiting", () => {
      const line = "- [ ] Do something";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBe("- [w] Do something");
    });

    test("should cycle waiting -> done", () => {
      const line = "- [w] Wait for John";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBe("- [x] Wait for John");
    });

    test("should cycle done -> todo", () => {
      const line = "- [x] Done task";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBe("- [ ] Done task");
    });

    test("should handle capital X in done tasks", () => {
      const line = "- [X] Done task";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBe("- [ ] Done task");
    });

    test("should preserve indentation", () => {
      const line = "  - [ ] Indented task";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBe("  - [w] Indented task");
    });

    test("should preserve asterisk bullets", () => {
      const line = "* [w] Wait for response";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBe("* [x] Wait for response");
    });

    test("should return null for non-task line", () => {
      const line = "Just regular text";
      const cycled = cycleTaskStatus(line);
      expect(cycled).toBeNull();
    });
  });
});
