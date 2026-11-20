import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const REMINDER_NOTIFICATION_ID = 73021;
const REMINDER_CHANNEL_ID = 'daily-inspection-reminder';
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
};

export const enableDailyInspectionReminder = async (userId, time) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) {
        throw new Error('알림 시간을 올바르게 선택해주세요.');
    }

    await ensurePermission();

    const [hour, minute] = time.split(':').map(Number);
    if (Capacitor.getPlatform() === 'android') {
        await LocalNotifications.createChannel({
            id: REMINDER_CHANNEL_ID,
            name: '업무 전 차량 점검 알림',
            description: '업무 시작 전 일상점검표 작성 알림',
            importance: 5,
            visibility: 1,
            vibration: true
        });
    }

    await LocalNotifications.cancel({
        notifications: [{ id: REMINDER_NOTIFICATION_ID }]
    });

    await LocalNotifications.schedule({
        notifications: [{
            id: REMINDER_NOTIFICATION_ID,
            title: '업무 전 차량 점검',
            body: '업무를 시작하기 전에 일상점검표를 작성해주세요.',
            channelId: REMINDER_CHANNEL_ID,
            schedule: {
                on: { hour, minute },
                allowWhileIdle: true
            }
        }]
    });

    saveReminderSetting(userId, { enabled: true, time });
};

export const disableDailyInspectionReminder = async (userId, time) => {
    if (Capacitor.isNativePlatform()) {
        await LocalNotifications.cancel({
            notifications: [{ id: REMINDER_NOTIFICATION_ID }]
        });
    }
    saveReminderSetting(userId, { enabled: false, time: time || '07:00' });
};
