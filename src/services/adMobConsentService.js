import { AdMob } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

const CONSENT_UPDATED_EVENT = 'deliverytracker:admob-consent-updated';

let consentInfoPromise = null;
let latestConsentInfo = null;
let initializationPromise = null;

function publishConsentInfo(info) {
    latestConsentInfo = info || null;

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, {
            detail: latestConsentInfo
        }));
    }
}

export function getAdMobConsentInfo() {
    return latestConsentInfo;
}

export async function ensureAdMobConsent() {
    if (Capacitor.getPlatform() === 'web') return null;

    if (!consentInfoPromise) {
        consentInfoPromise = (async () => {
            // UMP consent information must be refreshed on each app launch.
            const initialInfo = await AdMob.requestConsentInfo();
            let consentInfo = initialInfo;

            if (
                initialInfo?.isConsentFormAvailable &&
                initialInfo.status === 'REQUIRED'
            ) {
                consentInfo = await AdMob.showConsentForm();
            }

            publishConsentInfo(consentInfo);
            return consentInfo;
        })().catch(error => {
            consentInfoPromise = null;
            throw error;
        });
    }

    return consentInfoPromise;
}

export async function initializeAdMobWithConsent() {
    const consentInfo = await ensureAdMobConsent();
    if (!consentInfo?.canRequestAds) return false;

    if (!initializationPromise) {
        initializationPromise = AdMob.initialize().catch(error => {
            initializationPromise = null;
            throw error;
        });
    }

    await initializationPromise;
    return true;
}

export async function showAdMobPrivacyOptions() {
    const consentInfo = await ensureAdMobConsent();

    if (consentInfo?.privacyOptionsRequirementStatus !== 'REQUIRED') {
        return false;
    }

    await AdMob.showPrivacyOptionsForm();

    // Refresh the current choice after the user closes the privacy options form.
    const updatedInfo = await AdMob.requestConsentInfo();
    publishConsentInfo(updatedInfo);
    return true;
}

export const ADMOB_CONSENT_UPDATED_EVENT = CONSENT_UPDATED_EVENT;
