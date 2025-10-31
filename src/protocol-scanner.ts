// ABOUTME: Scans vault for review protocol files and parses their frontmatter and content.
// ABOUTME: Returns array of ReviewProtocol objects for use by protocol matcher and CLI.

import * as fs from 'fs';
import * as path from 'path';
import { ReviewProtocol } from './types';

export function scanReviewProtocols(vaultPath: string): ReviewProtocol[] {
  const reviewsDir = path.join(vaultPath, '.flow', 'reviews');

  if (!fs.existsSync(reviewsDir)) {
    return [];
  }

  return [];
}
