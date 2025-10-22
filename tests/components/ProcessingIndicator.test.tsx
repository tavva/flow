import React from "react";
import { render } from "ink-testing-library";
import { ProcessingIndicator } from "../../src/components/ProcessingIndicator";

describe("ProcessingIndicator", () => {
  it("should display status message", () => {
    const { lastFrame } = render(<ProcessingIndicator status="Processing..." />);

    expect(lastFrame()).toContain("Processing...");
  });
});
