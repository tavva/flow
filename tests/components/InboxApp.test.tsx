import React from "react";
import { render } from "ink-testing-library";
import { InboxApp } from "../../src/components/InboxApp";

describe("InboxApp", () => {
  it("should render MultilineTextarea initially", () => {
    const onComplete = jest.fn();
    const { lastFrame, unmount } = render(<InboxApp onComplete={onComplete} />);

    expect(lastFrame()).toContain("What's on your mind?");

    unmount();
  });
});
