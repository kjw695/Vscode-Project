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
const STORAGE_KEY_PREFIX = 'dailyInspectionReminder:v1:user:';

const getStorageKey = (userId) => `${STORAGE_KEY_PREFIX}${userId || 'guest'}`;

export const readDailyInspectionReminder = (userId) => {
    try {
        const raw = localStorage.getItem(getStorageKey(userId));
        const parsed = raw ? JSON.parse(raw) : null;
        return {
            enabled: Boolean(parsed?.enabled),
            time: /^([01]\d|2[0-3]):[0-5]\d$/.test(parsed?.time || '') ? parsed.time : '07:00'
        };
    } catch (error) {
        console.warn('[DailyInspectionReminder] 설정을 읽지 못했습니다:', error);
        return { enabled: false, time: '07:00' };
    }
};

const saveReminderSetting = (userId, setting) => {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(setting));
};

const scheduleReminderNotification = async (userId, time) => {
    const [hour, minute] = time.split(':').map(Number);
    const notificationId = getReminderNotificationId(userId);

    await LocalNotifications.cancel({
        notifications: [{ id: notificationId }]
    });

    await LocalNotifications.schedule({
        notifications: [{
            id: notificationId,
            title: '택배메이트 · 업무 전 차량 점검',
            body: '업무를 시작하기 전에 일상점검표를 작성해주세요.',
            smallIcon: 'ic_stat_app_icon',
            largeIcon: 'ic_launcher_notification',
            iconColor: '#2563EB',
            schedule: {
                on: { hour, minute },
                allowWhileIdle: true
            }
        }]
    });
};

export const refreshDailyInspectionReminder = async (userId) => {
    if (!Capacitor.isNativePlatform()) return;

    const setting = readDailyInspectionReminder(userId);
    if (!setting.enabled) return;

    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') return;

    await scheduleReminderNotification(userId, setting.time);
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

export const enableDailyInspectionReminder = async (userId, time) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) {
        throw new Error('알림 시간을 올바르게 선택해주세요.');
    }

    await ensurePermission();

    await scheduleReminderNotification(userId, time);
    saveReminderSetting(userId, { enabled: true, time });
};

export const disableDailyInspectionReminder = async (userId, time) => {
    if (Capacitor.isNativePlatform()) {
        await LocalNotifications.cancel({
            notifications: [{ id: getReminderNotificationId(userId) }]
        });
    }
    saveReminderSetting(userId, { enabled: false, time: time || '07:00' });
};
