import { ReviewProtocol } from "../src/types";

// Import the detectProtocolInvocation function
// Note: This is a private function in cli.tsx, so we'll test it indirectly through integration
// For now, we'll create a standalone version to test the logic

function detectProtocolInvocation(
  input: string,
  protocols: ReviewProtocol[]
): ReviewProtocol | null {
  const lowerInput = input.toLowerCase();

  // Check for review/protocol invocation patterns
  const patterns = [
    /(?:run|start|do|begin)\s+(?:the\s+)?(.+?)\s+(?:review|protocol)/i,
    /(?:review|protocol):\s*(.+)/i,
    /^(.+?)\s+review$/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      const searchTerm = match[1].trim().toLowerCase();

      // Try to find matching protocol
      const protocol = protocols.find(
        (p) =>
          p.name.toLowerCase().includes(searchTerm) || p.filename.toLowerCase().includes(searchTerm)
      );

      if (protocol) {
        return protocol;
      }
    }
  }

  return null;
}

describe("Protocol Invocation Detection", () => {
  const mockProtocols: ReviewProtocol[] = [
    {
      filename: "friday-review.md",
      name: "Friday Afternoon Review",
      content: "Friday review content",
    },
    {
      filename: "monday-review.md",
      name: "Monday Morning Review",
      content: "Monday review content",
    },
    {
      filename: "weekly.md",
      name: "Weekly Review",
      content: "Weekly review content",
    },
  ];

  it("should detect 'run X review' pattern", () => {
    const result = detectProtocolInvocation("run friday review", mockProtocols);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Friday Afternoon Review");
  });

  it("should detect 'start the X review' pattern", () => {
    const result = detectProtocolInvocation("start the weekly review", mockProtocols);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Weekly Review");
  });

  it("should detect 'do X review' pattern", () => {
    const result = detectProtocolInvocation("do monday review", mockProtocols);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Monday Morning Review");
  });

  it("should detect 'X review' pattern at start", () => {
    const result = detectProtocolInvocation("friday review", mockProtocols);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Friday Afternoon Review");
  });

  it("should match by partial name (case-insensitive)", () => {
    const result = detectProtocolInvocation("run FRIDAY review", mockProtocols);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Friday Afternoon Review");
  });

  it("should match by filename", () => {
    const result = detectProtocolInvocation("run monday-review review", mockProtocols);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Monday Morning Review");
  });

  it("should return null for non-matching input", () => {
    const result = detectProtocolInvocation("help me with projects", mockProtocols);
    expect(result).toBeNull();
  });

  it("should return null for review mention without protocol name", () => {
    const result = detectProtocolInvocation("let's review my projects", mockProtocols);
    expect(result).toBeNull();
  });

  it("should return null when protocol name doesn't match", () => {
    const result = detectProtocolInvocation("run quarterly review", mockProtocols);
    expect(result).toBeNull();
  });

  it("should handle 'review: X' colon syntax", () => {
    const result = detectProtocolInvocation("review: weekly", mockProtocols);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Weekly Review");
  });

  it("should detect 'begin' variant", () => {
    const result = detectProtocolInvocation("begin friday review", mockProtocols);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Friday Afternoon Review");
  });
});
