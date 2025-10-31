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
});
