import { matchProtocolsForTime } from '../src/protocol-matcher';
import { ReviewProtocol } from '../src/types';

describe('matchProtocolsForTime', () => {
  it('returns empty array when no protocols provided', () => {
    const result = matchProtocolsForTime([], new Date('2025-10-31T15:00:00'));
    expect(result).toEqual([]);
  });

  it('matches protocol with correct day and afternoon time', () => {
    const protocols: ReviewProtocol[] = [
      {
        filename: 'friday.md',
        name: 'Friday Review',
        trigger: { day: 'friday', time: 'afternoon' },
        content: 'Content',
      },
    ];

    const fridayAfternoon = new Date('2025-10-31T15:00:00'); // Friday 3pm

    const result = matchProtocolsForTime(protocols, fridayAfternoon);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Friday Review');
  });

  it('does not match protocol with wrong day', () => {
    const protocols: ReviewProtocol[] = [
      {
        filename: 'friday.md',
        name: 'Friday Review',
        trigger: { day: 'friday', time: 'afternoon' },
        content: 'Content',
      },
    ];

    const mondayAfternoon = new Date('2025-11-03T15:00:00'); // Monday 3pm

    const result = matchProtocolsForTime(protocols, mondayAfternoon);

    expect(result).toEqual([]);
  });
});
