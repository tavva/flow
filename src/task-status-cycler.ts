// ABOUTME: Cycles task checkbox status between [ ], [w], and [x] states.
// ABOUTME: Supports command to cycle task status on the current line in the editor.

export type TaskStatus = "todo" | "waiting" | "done";

const TASK_PATTERN = /^(\s*[-*]\s*)\[([ wWxX])\]\s*(.*)$/;

export function getTaskStatusAtLine(line: string): TaskStatus | null {
  const match = line.match(TASK_PATTERN);
  if (!match) {
    return null;
  }

  const status = match[2].toLowerCase();
  if (status === " ") return "todo";
  if (status === "w") return "waiting";
  if (status === "x") return "done";

  return null;
}

export function cycleTaskStatus(line: string): string | null {
  const match = line.match(TASK_PATTERN);
  if (!match) {
    return null;
  }

  const prefix = match[1];
  const currentStatus = match[2].toLowerCase();
  const text = match[3];

  let newStatus: string;
  if (currentStatus === " ") {
    newStatus = "w";
  } else if (currentStatus === "w") {
    newStatus = "x";
  } else if (currentStatus === "x") {
    newStatus = " ";
  } else {
    return null;
  }

  return `${prefix}[${newStatus}] ${text}`;
}
