// ABOUTME: Custom mock for ink-testing-library v4 to work around Jest's poor ESM support.
// ABOUTME: ink-testing-library v4 is pure ESM and depends on ink v5, both of which use import.meta.
//
// This mock provides a minimal render() function that uses React's testing utilities
// to render Ink components in a Jest-compatible way. When the project migrates to
// Vitest (which has proper ESM support), this mock can be removed.
//
// See tests/README.md for more details on the testing approach.

import React from "react";
import { create, ReactTestRenderer } from "react-test-renderer";

export interface RenderResult {
  lastFrame: () => string;
  frames: string[];
  unmount: () => void;
  rerender: (tree: React.ReactElement) => void;
  stdin: {
    write: (data: string) => void;
  };
  stdout: string;
  stderr: string;
}

/**
 * Minimal render() implementation for testing Ink components.
 *
 * This is a simplified version of ink-testing-library's render() that:
 * - Uses react-test-renderer to render the component tree
 * - Captures the output as a string (lastFrame)
 * - Provides a stub stdin for simulating input
 * - Doesn't support actual terminal rendering or interaction
 *
 * Limitations:
 * - No actual useInput() hook functionality
 * - No terminal layout calculations
 * - No ANSI color support in output
 */
export function render(tree: React.ReactElement): RenderResult {
  let renderer: ReactTestRenderer | null = null;
  const frames: string[] = [];

  // Render the component tree
  renderer = create(tree);

  // Extract text content from the rendered component
  const extractText = (node: any): string => {
    if (typeof node === "string" || typeof node === "number") {
      return String(node);
    }
    if (!node) return "";
    if (Array.isArray(node)) {
      return node.map(extractText).join("");
    }
    if (typeof node === "object") {
      // Handle React test renderer output structure
      if (node.children) {
        return extractText(node.children);
      }
      if (node.props?.children) {
        return extractText(node.props.children);
      }
    }
    return "";
  };

  const getFrame = (): string => {
    if (!renderer) return "";
    const json = renderer.toJSON();
    const output = extractText(json);
    return output;
  };

  const currentFrame = getFrame();
  frames.push(currentFrame);

  return {
    lastFrame: () => frames[frames.length - 1] || "",
    frames,
    unmount: () => {
      if (renderer) {
        renderer.unmount();
        renderer = null;
      }
    },
    rerender: (newTree: React.ReactElement) => {
      if (renderer) {
        renderer.update(newTree);
        const frame = getFrame();
        frames.push(frame);
      }
    },
    stdin: {
      write: jest.fn(),
    },
    stdout: "",
    stderr: "",
  };
}
