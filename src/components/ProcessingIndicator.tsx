// ABOUTME: Displays processing status with spinner during AI operations.
// ABOUTME: Shows status message and animated indicator for user feedback.

import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

export interface ProcessingIndicatorProps {
  status: string;
}

export function ProcessingIndicator({ status }: ProcessingIndicatorProps) {
  return (
    <Box>
      <Text color="green">
        <Spinner type="dots" />
      </Text>
      <Text> {status}</Text>
    </Box>
  );
}
