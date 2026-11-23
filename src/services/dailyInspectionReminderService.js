import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const getReminderNotificationId = (userId) => {
    const source = String(userId || 'guest');
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return 70000 + ((hash >>> 0) % 2000000000);
};

const getReminderNotificationIdForDate = (userId, dateKey) => {
    const source = `${String(userId || 'guest')}:daily-inspection:${dateKey}`;
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return 70000 + ((hash >>> 0) % 2000000000);
};

const STORAGE_KEY_PREFIX = 'dailyInspectionReminder:v1:user:';
const REMINDER_LOOKAHEAD_DAYS = 30;

const getStorageKey = (userId) => `${STORAGE_KEY_PREFIX}${userId || 'guest'}`;

export const readDailyInspectionReminder = (userId) => {
    try {
        const raw = localStorage.getItem(getStorageKey(userId));
        const parsed = raw ? JSON.parse(raw) : null;
        return {
            enabled: Boolean(parsed?.enabled),
            time: /^([01]\d|2[0-3]):[0-5]\d$/.test(parsed?.time || '') ? parsed.time : '07:00',
            includeOffDays: Boolean(parsed?.includeOffDays),
            notificationIds: Array.isArray(parsed?.notificationIds)
                ? parsed.notificationIds.filter((id) => Number.isInteger(id))
                : []
        };
    } catch (error) {
        console.warn('[DailyInspectionReminder] 설정을 읽지 못했습니다:', error);
        return { enabled: false, time: '07:00', includeOffDays: false, notificationIds: [] };
    }
};

const saveReminderSetting = (userId, setting) => {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(setting));
};

const getLocalDateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const buildReminderNotifications = (userId, time, offDates = [], includeOffDays = false, now = new Date()) => {
    const [hour, minute] = time.split(':').map(Number);
    const offDateSet = new Set(Array.isArray(offDates) ? offDates : []);
    const notifications = [];

    for (let offset = 0; offset < REMINDER_LOOKAHEAD_DAYS; offset += 1) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
        const dateKey = getLocalDateKey(day);
        if (!includeOffDays && offDateSet.has(dateKey)) continue;

        const scheduledAt = new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            hour,
            minute,
            0,
            0
        );
        if (scheduledAt <= now) continue;

        notifications.push({
            id: getReminderNotificationIdForDate(userId, dateKey),
            title: '택배메이트 · 업무 전 차량 점검',
            body: '업무를 시작하기 전에 일상점검표를 작성해주세요.',
            smallIcon: 'ic_stat_app_icon',
            largeIcon: 'ic_launcher_notification',
            iconColor: '#2563EB',
            extra: {
                type: 'dailyInspectionReminder',
                userId: String(userId || 'guest'),
                dateKey
            },
            schedule: {
                at: scheduledAt,
                allowWhileIdle: true
            }
        });
    }

    return notifications;
};

const cancelScheduledReminders = async (userId, setting) => {
    if (!Capacitor.isNativePlatform()) return;

    const ids = [...new Set([
        getReminderNotificationId(userId),
        ...(setting.notificationIds || [])
    ])];
    await LocalNotifications.cancel({
        notifications: ids.map((id) => ({ id }))
    });
};

const replaceScheduledReminders = async (userId, setting, offDates = []) => {
    await cancelScheduledReminders(userId, setting);

    const notifications = buildReminderNotifications(
        userId,
        setting.time,
        offDates,
        setting.includeOffDays
    );

    if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
    }

    const notificationIds = notifications.map((notification) => notification.id);
    saveReminderSetting(userId, {
        ...setting,
        notificationIds
    });
    return notificationIds;
};

export const refreshDailyInspectionReminder = async (userId, offDates = []) => {
    if (!Capacitor.isNativePlatform()) return;

    const setting = readDailyInspectionReminder(userId);
    if (!setting.enabled) return;

    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') return;

    await replaceScheduledReminders(userId, setting, offDates);
};

const ensurePermission = async () => {
    if (!Capacitor.isNativePlatform()) {
        throw new Error('기기 알림은 설치된 앱에서 설정할 수 있습니다.');
    }

    let permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
        permission = await LocalNotifications.requestPermissions();
    }

    if (permission.display !== 'granted') {
        throw new Error('알림 권한이 허용되지 않았습니다. 휴대폰 설정에서 택배메이트 알림을 허용해주세요.');
    }

    if (Capacitor.getPlatform() === 'android') {
        let exactPermission = await LocalNotifications.checkExactNotificationSetting();
        if (exactPermission.exact_alarm !== 'granted') {
            await LocalNotifications.changeExactNotificationSetting();
            exactPermission = await LocalNotifications.checkExactNotificationSetting();
        }
        if (exactPermission.exact_alarm !== 'granted') {
            throw new Error('정확한 알람 권한이 필요합니다. 휴대폰 설정에서 택배메이트의 알람 및 리마인더를 허용한 뒤 다시 눌러주세요.');
        }
    }
};

export const enableDailyInspectionReminder = async (userId, time, options = {}) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) {
        throw new Error('알림 시간을 올바르게 선택해주세요.');
    }

    await ensurePermission();

    const previous = readDailyInspectionReminder(userId);
    await replaceScheduledReminders(userId, {
        ...previous,
        enabled: true,
        time,
        includeOffDays: Boolean(options.includeOffDays)
    }, options.offDates || []);
};

export const disableDailyInspectionReminder = async (userId, time) => {
    const setting = readDailyInspectionReminder(userId);
    await cancelScheduledReminders(userId, setting);
    saveReminderSetting(userId, {
        ...setting,
        enabled: false,
        time: time || setting.time || '07:00',
        notificationIds: []
    });
};

/**
 * Removes the account-scoped reminder preference and cancels its scheduled
 * local notifications after the server confirms account deletion.
 */
export const clearDailyInspectionReminder = async (userId) => {
    let cancelled = true;
    try {
        await cancelScheduledReminders(userId, readDailyInspectionReminder(userId));
    } catch (error) {
        cancelled = false;
        console.warn('[DailyInspectionReminder] 탈퇴 후 예약 알림 취소 실패:', error);
    }
    try {
        localStorage.removeItem(getStorageKey(userId));
    } catch (error) {
        console.warn('[DailyInspectionReminder] 탈퇴 후 알림 설정 정리 실패:', error);
    }
    return { cancelled };
};
