import React from "react";

export function render(element: React.ReactElement) {
  let lastOutput = "";

  // Simple mock that captures the rendered output
  const captureOutput = (node: React.ReactElement): string => {
    if (typeof node === "string") {
      return node;
    }

    if (!node || !node.props) {
      return "";
    }

    let output = "";

    // Handle Text components
    if (node.type && typeof node.type === "function" && node.type.name === "Text") {
      if (typeof node.props.children === "string") {
        output += node.props.children;
      } else if (Array.isArray(node.props.children)) {
        output += node.props.children.join("");
      }
    }

    // Handle Box components - recursively process children
    if (node.props.children) {
      if (typeof node.props.children === "string") {
        output += node.props.children;
      } else if (Array.isArray(node.props.children)) {
        output += node.props.children
          .map((child: any) => {
            if (typeof child === "string") {
              return child;
            }
            if (React.isValidElement(child)) {
              return captureOutput(child);
            }
            return "";
          })
          .join("");
      } else if (React.isValidElement(node.props.children)) {
        output += captureOutput(node.props.children);
      }
    }

    return output;
  };

  // Attempt to render the element tree
  try {
    // For functional components, call them to get the rendered output
    if (typeof element.type === "function") {
      const rendered = element.type(element.props);
      lastOutput = captureOutput(rendered);
    } else {
      lastOutput = captureOutput(element);
    }
  } catch (e) {
    // If rendering fails, just capture whatever we can from props
    lastOutput = JSON.stringify(element.props);
  }

  return {
    lastFrame: () => lastOutput,
    frames: [lastOutput],
    stdin: {
      write: jest.fn(),
    },
    unmount: jest.fn(),
  };
}
