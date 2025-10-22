// ABOUTME: Multiline text input component for Ink supporting Shift+Enter for newlines
// ABOUTME: and Enter to submit, with paste detection for multiline content.

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export interface MultilineTextareaProps {
  prompt: string;
  onSubmit: (text: string) => void;
}

export function MultilineTextarea({ prompt, onSubmit }: MultilineTextareaProps) {
  const [lines, setLines] = useState<string[]>([""]);
  const [cursorRow, setCursorRow] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);

  useInput((input, key) => {
    // Insert newline on Ctrl+Enter or Ctrl+J
    if ((key.return && key.ctrl) || (input === "\n" && key.ctrl)) {
      setLines((prevLines) => {
        const newLines = [...prevLines];
        const currentLine = newLines[cursorRow];
        // Split current line at cursor
        const before = currentLine.slice(0, cursorCol);
        const after = currentLine.slice(cursorCol);
        newLines[cursorRow] = before;
        newLines.splice(cursorRow + 1, 0, after);
        return newLines;
      });
      setCursorRow((prev) => prev + 1);
      setCursorCol(0);
      return;
    }

    // Submit on Enter (without Ctrl)
    if (key.return && !key.ctrl) {
      const text = lines.join("\n").trim();
      if (text) {
        onSubmit(text);
        // Reset state
        setLines([""]);
        setCursorRow(0);
        setCursorCol(0);
      }
      return;
    }

    // Legacy: Also support Shift+Enter for newlines (if terminal supports it)
    if (key.return && key.shift) {
      setLines((prevLines) => {
        const newLines = [...prevLines];
        const currentLine = newLines[cursorRow];
        // Split current line at cursor
        const before = currentLine.slice(0, cursorCol);
        const after = currentLine.slice(cursorCol);
        newLines[cursorRow] = before;
        newLines.splice(cursorRow + 1, 0, after);
        return newLines;
      });
      setCursorRow((prev) => prev + 1);
      setCursorCol(0);
      return;
    }

    // Handle backspace
    if (key.backspace || key.delete) {
      if (cursorCol > 0) {
        // Delete character before cursor
        setLines((prevLines) => {
          const newLines = [...prevLines];
          const currentLine = newLines[cursorRow];
          newLines[cursorRow] =
            currentLine.slice(0, cursorCol - 1) + currentLine.slice(cursorCol);
          return newLines;
        });
        setCursorCol((prev) => prev - 1);
      } else if (cursorRow > 0) {
        // Merge with previous line
        const prevLineLength = lines[cursorRow - 1].length;
        setLines((prevLines) => {
          const newLines = [...prevLines];
          const currentLine = newLines[cursorRow];
          const prevLine = newLines[cursorRow - 1];
          newLines[cursorRow - 1] = prevLine + currentLine;
          newLines.splice(cursorRow, 1);
          return newLines;
        });
        setCursorRow((prev) => prev - 1);
        setCursorCol(prevLineLength);
      }
      return;
    }

    // Handle regular character input (including Shift+character for capitals)
    if (!key.return && !key.ctrl && !key.meta && input.length === 1) {
      setLines((prevLines) => {
        const newLines = [...prevLines];
        const currentLine = newLines[cursorRow];
        newLines[cursorRow] =
          currentLine.slice(0, cursorCol) + input + currentLine.slice(cursorCol);
        return newLines;
      });
      setCursorCol((prev) => prev + 1);
    }
  });

  return (
    <Box flexDirection="column">
      <Text>{prompt} (Ctrl+Enter for new line, Enter to submit)</Text>
      <Text>{""}</Text>
      {lines.map((line, index) => (
        <Box key={index}>
          <Text color="cyan">&gt; </Text>
          <Text>{line}</Text>
        </Box>
      ))}
    </Box>
  );
}
