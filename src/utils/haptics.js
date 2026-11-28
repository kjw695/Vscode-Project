import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Native haptic feedback. Failures are intentionally isolated from the action
 * that triggered the feedback so saving or syncing never depends on vibration.
 */
export const triggerHaptic = async (type = 'light') => {
    try {
        if (!Capacitor.isNativePlatform()) return;

        if (type === 'success') {
            await Haptics.notification({ type: NotificationType.Success });
            return;
        }

        await Haptics.impact({
            style: type === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light
        });
    } catch (error) {
        console.warn('Haptic feedback could not be performed:', error);
    }
};
