// ABOUTME: Matches review protocols against current date/time to determine which should be suggested.
// ABOUTME: Supports day-of-week and time-of-day matching (morning/afternoon/evening).

import { ReviewProtocol } from './types';

const TIME_PERIODS = {
  morning: { start: 5, end: 12 },      // 05:00-11:59
  afternoon: { start: 12, end: 18 },   // 12:00-17:59
  evening: { start: 18, end: 5 },      // 18:00-04:59 (crosses midnight)
};

const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function matchProtocolsForTime(
  protocols: ReviewProtocol[],
  currentTime: Date
): ReviewProtocol[] {
  const matches: ReviewProtocol[] = [];

  for (const protocol of protocols) {
    // Skip protocols without triggers
    if (!protocol.trigger) {
      continue;
    }

    // Check day match
    if (protocol.trigger.day) {
      const currentDay = DAYS_OF_WEEK[currentTime.getDay()];
      if (currentDay !== protocol.trigger.day.toLowerCase()) {
        continue;
      }
    }

    // Check time match
    if (protocol.trigger.time) {
      const currentHour = currentTime.getHours();
      const period = TIME_PERIODS[protocol.trigger.time as keyof typeof TIME_PERIODS];

      if (!period) {
        continue;
      }

      // Handle time periods that cross midnight (evening)
      if (period.end < period.start) {
        if (currentHour < period.start && currentHour >= period.end) {
          continue;
        }
      } else {
        if (currentHour < period.start || currentHour >= period.end) {
          continue;
        }
      }
    }

    matches.push(protocol);
  }

  return matches;
}
