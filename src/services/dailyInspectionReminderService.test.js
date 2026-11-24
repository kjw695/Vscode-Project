jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(() => true),
    getPlatform: jest.fn(() => 'android')
  }
}));

jest.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    cancel: jest.fn(),
    schedule: jest.fn(),
    checkPermissions: jest.fn(),
    requestPermissions: jest.fn(),
    checkExactNotificationSetting: jest.fn(),
    changeExactNotificationSetting: jest.fn()
  }
}));

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  clearDailyInspectionReminder,
  DAILY_INSPECTION_NOTIFICATION_CHANNEL_ID,
  enableDailyInspectionReminder,
  readDailyInspectionReminder
} from './dailyInspectionReminderService';

const getDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const getNextHourTime = () => {
  const nextHour = (new Date().getHours() + 1) % 24;
  return `${String(nextHour).padStart(2, '0')}:00`;
};

describe('dailyInspectionReminderService', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    Capacitor.isNativePlatform.mockReturnValue(true);
    Capacitor.getPlatform.mockReturnValue('android');
    LocalNotifications.cancel.mockResolvedValue(undefined);
    LocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    LocalNotifications.checkPermissions.mockResolvedValue({ display: 'granted' });
    LocalNotifications.requestPermissions.mockResolvedValue({ display: 'granted' });
    LocalNotifications.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'granted' });
    LocalNotifications.changeExactNotificationSetting.mockResolvedValue(undefined);
  });

  test('reminders remain disabled until the user saves a setting', () => {
    expect(readDailyInspectionReminder('account-a')).toMatchObject({
      enabled: false,
      includeOffDays: false,
      notificationIds: []
    });
  });

  test('does not schedule notifications on registered off-days by default', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = getDateKey(tomorrow);

    await enableDailyInspectionReminder('account-a', getNextHourTime(), {
      offDates: [tomorrowKey]
    });

    const scheduled = LocalNotifications.schedule.mock.calls[0][0].notifications;
    expect(scheduled.every((notification) => notification.channelId === DAILY_INSPECTION_NOTIFICATION_CHANNEL_ID)).toBe(true);
    expect(scheduled.some((notification) => notification.extra.dateKey === tomorrowKey)).toBe(false);
    expect(scheduled.length).toBeGreaterThan(0);
    expect(readDailyInspectionReminder('account-a').includeOffDays).toBe(false);
    expect(readDailyInspectionReminder('account-a').notificationIds).toHaveLength(scheduled.length);
  });

  test('includes off-days when the user checks the option', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = getDateKey(tomorrow);

    await enableDailyInspectionReminder('account-a', getNextHourTime(), {
      includeOffDays: true,
      offDates: [tomorrowKey]
    });

    const scheduled = LocalNotifications.schedule.mock.calls[0][0].notifications;
    expect(scheduled.some((notification) => notification.extra.dateKey === tomorrowKey)).toBe(true);
    expect(readDailyInspectionReminder('account-a').includeOffDays).toBe(true);
  });

  test('cancels the account notifications and removes only that account setting', async () => {
    localStorage.setItem('dailyInspectionReminder:v1:user:account-a', JSON.stringify({
      enabled: true,
      time: '07:30',
      notificationIds: [12345, 23456]
    }));
    localStorage.setItem('dailyInspectionReminder:v1:user:account-b', JSON.stringify({ enabled: true, time: '08:00' }));

    const result = await clearDailyInspectionReminder('account-a');

    expect(result.cancelled).toBe(true);
    expect(LocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: expect.arrayContaining([
        { id: expect.any(Number) },
        { id: 12345 },
        { id: 23456 }
      ])
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
