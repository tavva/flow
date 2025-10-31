import { scanReviewProtocols } from '../src/protocol-scanner';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('scanReviewProtocols', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty array when reviews directory does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = scanReviewProtocols('/test/vault');

    expect(result).toEqual([]);
  });

  it('scans and returns markdown files from reviews directory', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      'friday-review.md',
      'monday-review.md',
      'notes.txt',  // Should be filtered out
    ] as any);
    mockFs.readFileSync.mockImplementation((filePath: any) => {
      if (filePath.includes('friday-review.md')) {
        return '---\ntrigger:\n  day: friday\n  time: afternoon\n---\n# Friday Review\n\nReview content here';
      }
      if (filePath.includes('monday-review.md')) {
        return '# Monday Review\n\nNo frontmatter here';
      }
      return '';
    });

    const result = scanReviewProtocols('/test/vault');

    expect(result).toHaveLength(2);
    expect(result[0].filename).toBe('friday-review.md');
    expect(result[0].name).toBe('Friday Review');
    expect(result[0].trigger?.day).toBe('friday');
    expect(result[0].trigger?.time).toBe('afternoon');
    expect(result[0].content).toContain('Review content here');

    expect(result[1].filename).toBe('monday-review.md');
    expect(result[1].name).toBe('Monday Review');
    expect(result[1].trigger).toBeUndefined();
  });
});
