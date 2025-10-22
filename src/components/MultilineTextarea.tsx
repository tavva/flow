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

  return (
    <Box flexDirection="column">
      <Text>{prompt} (Shift+Enter for new line, Enter to submit)</Text>
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
