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

  it('matches morning time period (5am-11:59am)', () => {
    const protocols: ReviewProtocol[] = [
      {
        filename: 'morning.md',
        name: 'Morning Review',
        trigger: { time: 'morning' },
        content: 'Content',
      },
    ];

    const morning = new Date('2025-10-31T08:00:00'); // 8am

    const result = matchProtocolsForTime(protocols, morning);

    expect(result).toHaveLength(1);
  });

  it('does not match morning at noon', () => {
    const protocols: ReviewProtocol[] = [
      {
        filename: 'morning.md',
        name: 'Morning Review',
        trigger: { time: 'morning' },
        content: 'Content',
      },
    ];

    const noon = new Date('2025-10-31T12:00:00'); // 12pm

    const result = matchProtocolsForTime(protocols, noon);

    expect(result).toEqual([]);
  });

  it('matches evening time period crossing midnight', () => {
    const protocols: ReviewProtocol[] = [
      {
        filename: 'evening.md',
        name: 'Evening Review',
        trigger: { time: 'evening' },
        content: 'Content',
      },
    ];

    const lateNight = new Date('2025-10-31T23:00:00'); // 11pm
    const earlyMorning = new Date('2025-11-01T02:00:00'); // 2am

    expect(matchProtocolsForTime(protocols, lateNight)).toHaveLength(1);
    expect(matchProtocolsForTime(protocols, earlyMorning)).toHaveLength(1);
  });

  it('matches protocol with day but no time', () => {
    const protocols: ReviewProtocol[] = [
      {
        filename: 'friday.md',
        name: 'Friday Review',
        trigger: { day: 'friday' },
        content: 'Content',
      },
    ];

    const fridayMorning = new Date('2025-10-31T08:00:00'); // Friday 8am
    const fridayEvening = new Date('2025-10-31T20:00:00'); // Friday 8pm

    expect(matchProtocolsForTime(protocols, fridayMorning)).toHaveLength(1);
    expect(matchProtocolsForTime(protocols, fridayEvening)).toHaveLength(1);
  });

  it('matches protocol with time but no day', () => {
    const protocols: ReviewProtocol[] = [
      {
        filename: 'afternoon.md',
        name: 'Afternoon Review',
        trigger: { time: 'afternoon' },
        content: 'Content',
      },
    ];

    const mondayAfternoon = new Date('2025-11-03T15:00:00'); // Monday 3pm
    const tuesdayAfternoon = new Date('2025-11-04T15:00:00'); // Tuesday 3pm

    expect(matchProtocolsForTime(protocols, mondayAfternoon)).toHaveLength(1);
    expect(matchProtocolsForTime(protocols, tuesdayAfternoon)).toHaveLength(1);
  });

  it('returns multiple matching protocols', () => {
    const protocols: ReviewProtocol[] = [
      {
        filename: 'friday1.md',
        name: 'Friday Review 1',
        trigger: { day: 'friday', time: 'afternoon' },
        content: 'Content',
      },
      {
        filename: 'friday2.md',
        name: 'Friday Review 2',
        trigger: { day: 'friday', time: 'afternoon' },
        content: 'Content',
      },
      {
        filename: 'monday.md',
        name: 'Monday Review',
        trigger: { day: 'monday', time: 'afternoon' },
        content: 'Content',
      },
    ];

    const fridayAfternoon = new Date('2025-10-31T15:00:00');

    const result = matchProtocolsForTime(protocols, fridayAfternoon);

    expect(result).toHaveLength(2);
    expect(result.map(p => p.name)).toEqual(['Friday Review 1', 'Friday Review 2']);
  });

  it('skips protocols without triggers', () => {
    const protocols: ReviewProtocol[] = [
      {
        filename: 'no-trigger.md',
        name: 'No Trigger Review',
        content: 'Content',
      },
    ];

    const result = matchProtocolsForTime(protocols, new Date());

    expect(result).toEqual([]);
  });
});
