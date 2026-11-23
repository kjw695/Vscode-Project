jest.mock('../lib/supabaseClient', () => ({ supabase: {} }));

import { getDeviceDateKey, getDeviceDateYearsAgo } from './dailyInspectionCloudService';

describe('dailyInspectionCloudService device-local date handling', () => {
  test('uses the device local calendar date, not a fixed Korea timezone', () => {
    const localDate = new Date(2026, 10, 24, 0, 30, 0);
    const expected = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    expect(getDeviceDateKey(localDate)).toBe(expected);
  });

  test('calculates a one-year cutoff using device-local calendar date', () => {
    const localDate = new Date(2026, 10, 24, 0, 30, 0);
    const expectedYear = localDate.getFullYear() - 1;
    const expected = `${expectedYear}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    expect(getDeviceDateYearsAgo(1, localDate)).toBe(expected);
  });

  test('clamps leap day when the previous year is not a leap year', () => {
    const leapDay = new Date(2024, 1, 29, 12, 0, 0);
    expect(getDeviceDateYearsAgo(1, leapDay)).toBe('2023-02-28');
  });
});
