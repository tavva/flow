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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setIsSubmitting(true);
        // Give React time to re-render before unmounting
        setTimeout(() => {
          onSubmit(text);
        }, 50);
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

    // Handle regular character input and paste (including Shift+character for capitals)
    if (!key.return && !key.ctrl && !key.meta && input.length > 0) {
      // Check if pasted content contains newlines
      if (input.includes('\n')) {
        const pastedLines = input.split('\n');
        setLines((prevLines) => {
          const newLines = [...prevLines];
          const currentLine = newLines[cursorRow];
          const before = currentLine.slice(0, cursorCol);
          const after = currentLine.slice(cursorCol);

          // Replace current line with before + first pasted line
          newLines[cursorRow] = before + pastedLines[0];

          // Insert all middle and remaining pasted lines
          for (let i = 1; i < pastedLines.length; i++) {
            newLines.splice(cursorRow + i, 0, pastedLines[i]);
          }

          // Append after to the last pasted line
          const lastLineIndex = cursorRow + pastedLines.length - 1;
          newLines[lastLineIndex] = newLines[lastLineIndex] + after;

          return newLines;
        });

        // Move cursor to end of last pasted content (before the 'after' part)
        const lastPastedLine = pastedLines[pastedLines.length - 1];
        setCursorRow((prev) => prev + pastedLines.length - 1);
        setCursorCol(lastPastedLine.length);
      } else {
        // Single or multi-character input without newlines
        setLines((prevLines) => {
          const newLines = [...prevLines];
          const currentLine = newLines[cursorRow];
          newLines[cursorRow] =
            currentLine.slice(0, cursorCol) + input + currentLine.slice(cursorCol);
          return newLines;
        });
        setCursorCol((prev) => prev + input.length);
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Text dimColor>• Ctrl+J for new line, Enter to submit</Text>
      <Text>{""}</Text>
      {lines.map((line, index) => {
        const isCurrentLine = index === cursorRow;

        // Build line with cursor inserted at correct position
        // Don't show cursor when submitting (about to unmount)
        let displayContent;
        if (isCurrentLine && !isSubmitting) {
          const before = line.slice(0, cursorCol);
          const after = line.slice(cursorCol);
          displayContent = (
            <>
              {before}
              <Text color="yellow">█</Text>
              {after}
            </>
          );
        } else {
          displayContent = line;
        }

        return (
          <Box key={index}>
            <Text color="cyan">&gt; </Text>
            <Text>{displayContent}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
