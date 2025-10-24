// ABOUTME: Root Ink component orchestrating the inbox input flow.
// ABOUTME: Manages state transitions from input to processing to results display.

import React, { useState } from "react";
import { Box, Text } from "ink";
import { MultilineTextarea } from "./MultilineTextarea";

export interface InboxAppProps {
  onComplete: (text: string) => void;
}

export function InboxApp({ onComplete }: InboxAppProps) {
  const [inputText, setInputText] = useState<string | null>(null);

  const handleSubmit = (text: string) => {
    setInputText(text);
    onComplete(text);
  };

  if (inputText === null) {
    return (
      <Box flexDirection="column">
        <MultilineTextarea prompt=">" onSubmit={handleSubmit} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>Processing...</Text>
    </Box>
  );
}
