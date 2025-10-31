// ABOUTME: Scans vault for review protocol files and parses their frontmatter and content.
// ABOUTME: Returns array of ReviewProtocol objects for use by protocol matcher and CLI.

import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { ReviewProtocol } from './types';

export function scanReviewProtocols(vaultPath: string): ReviewProtocol[] {
  const reviewsDir = path.join(vaultPath, '.flow', 'reviews');

  if (!fs.existsSync(reviewsDir)) {
    return [];
  }

  const files = fs.readdirSync(reviewsDir);
  const protocols: ReviewProtocol[] = [];

  for (const file of files) {
    // Skip non-markdown files
    if (!file.endsWith('.md')) {
      continue;
    }

    const filePath = path.join(reviewsDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    try {
      const parsed = matter(fileContent);
      const name = extractProtocolName(parsed.content, file);

      const protocol: ReviewProtocol = {
        filename: file,
        name,
        content: parsed.content,
      };

      // Add trigger if present in frontmatter
      if (parsed.data.trigger) {
        protocol.trigger = {
          day: parsed.data.trigger.day,
          time: parsed.data.trigger.time,
        };
      }

      // Add spheres if present in frontmatter
      if (parsed.data.spheres) {
        protocol.spheres = parsed.data.spheres;
      }

      protocols.push(protocol);
    } catch (error) {
      // Log warning and skip invalid files
      console.warn(`Failed to parse review protocol ${file}:`, error);
      continue;
    }
  }

  return protocols;
}

function extractProtocolName(content: string, filename: string): string {
  // Extract name from first H1 heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // Fallback to filename without extension
  return filename.replace('.md', '');
}
