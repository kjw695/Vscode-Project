jest.mock('../lib/supabaseClient', () => ({ supabase: {} }));

import { getKoreaDateKey, getKoreaDateYearsAgo } from './dailyInspectionCloudService';

describe('dailyInspectionCloudService Korea date handling', () => {
  test('uses Korea calendar date after UTC midnight boundary', () => {
    expect(getKoreaDateKey(new Date('2026-11-23T15:30:00.000Z'))).toBe('2026-11-24');
  });

  test('uses Korea calendar date before UTC date changes', () => {
    expect(getKoreaDateKey(new Date('2026-11-23T14:59:59.000Z'))).toBe('2026-11-23');
  });

  test('calculates the two-year cutoff using Korea date and clamps leap day', () => {
    expect(getKoreaDateYearsAgo(2, new Date('2024-02-28T15:00:00.000Z'))).toBe('2022-02-28');
  });
});
