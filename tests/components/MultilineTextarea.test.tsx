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
});
