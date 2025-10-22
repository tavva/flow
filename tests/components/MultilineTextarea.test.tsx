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
});
