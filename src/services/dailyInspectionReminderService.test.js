jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(() => true),
    getPlatform: jest.fn(() => 'android')
  }
}));

jest.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    cancel: jest.fn()
  }
}));

import { LocalNotifications } from '@capacitor/local-notifications';
import { clearDailyInspectionReminder } from './dailyInspectionReminderService';

describe('dailyInspectionReminderService account cleanup', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    LocalNotifications.cancel.mockResolvedValue(undefined);
  });

  test('cancels the account notification and removes only that account setting', async () => {
    localStorage.setItem('dailyInspectionReminder:v1:user:account-a', JSON.stringify({ enabled: true, time: '07:30' }));
    localStorage.setItem('dailyInspectionReminder:v1:user:account-b', JSON.stringify({ enabled: true, time: '08:00' }));

    const result = await clearDailyInspectionReminder('account-a');

    expect(result.cancelled).toBe(true);
    expect(LocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: [{ id: expect.any(Number) }]
    });
    expect(localStorage.getItem('dailyInspectionReminder:v1:user:account-a')).toBeNull();
    expect(localStorage.getItem('dailyInspectionReminder:v1:user:account-b')).not.toBeNull();
  });

  test('removes the local preference even when notification cancellation fails', async () => {
    localStorage.setItem('dailyInspectionReminder:v1:user:account-a', JSON.stringify({ enabled: true, time: '07:30' }));
    LocalNotifications.cancel.mockRejectedValue(new Error('notification service unavailable'));

    const result = await clearDailyInspectionReminder('account-a');

    expect(result.cancelled).toBe(false);
    expect(localStorage.getItem('dailyInspectionReminder:v1:user:account-a')).toBeNull();
  });
});
