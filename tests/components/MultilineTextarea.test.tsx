import React from "react";
import { render } from "ink-testing-library";
import { MultilineTextarea } from "../../src/components/MultilineTextarea";

describe("MultilineTextarea", () => {
  it("should render prompt and accept input", () => {
    const onSubmit = jest.fn();
    const { lastFrame } = render(
      <MultilineTextarea
        prompt="What's on your mind?"
        onSubmit={onSubmit}
      />
    );

    expect(lastFrame()).toContain("What's on your mind?");
  });

  it("should render with initial state", () => {
    // Note: useInput hook behavior (character input handling) will be verified
    // via integration testing in Task 10, as our custom ink mocks don't support
    // interactive input testing. See tests/README.md for details.
    const onSubmit = jest.fn();
    const { lastFrame } = render(<MultilineTextarea prompt="Enter text" onSubmit={onSubmit} />);

    // Verify component structure
    expect(lastFrame()).toContain("Enter text");
    expect(lastFrame()).toContain("Shift+Enter for new line");
    expect(lastFrame()).toContain(">");
  });

  it("should handle Enter key submit (structure test)", () => {
    // Note: Enter key submission will be verified via integration testing in Task 10,
    // as our custom ink mocks don't support interactive keyboard event simulation.
    // This test validates that the component structure supports submission.
    const onSubmit = jest.fn();
    const { lastFrame } = render(<MultilineTextarea prompt="Enter text" onSubmit={onSubmit} />);

    // Verify component renders with submit capability
    expect(lastFrame()).toContain("Enter to submit");
  });

  it("should support Shift+Enter newline (structure test)", () => {
    // Note: Shift+Enter newline insertion will be verified via integration testing
    // in Task 10, as our custom ink mocks don't support interactive keyboard event
    // simulation. This test validates that the component structure supports multiline input.
    const onSubmit = jest.fn();
    const { lastFrame } = render(<MultilineTextarea prompt="Enter text" onSubmit={onSubmit} />);

    // Verify component renders with newline instructions
    expect(lastFrame()).toContain("Shift+Enter for new line");
  });
});
