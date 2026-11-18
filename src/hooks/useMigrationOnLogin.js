// Prepares legacy local records safely after the authenticated account is known.
// Legacy records are classified locally only; this hook never uploads them.
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUnclassifiedLegacyData, getUnclassifiedLegacySettings, importUnclassifiedLegacyDataToAccount, migrateLocalDataToServer, reserveUnclassifiedLegacyDataForAccount, prepareLegacyDataForGuest } from '../utils/migration';

export function useMigrationOnLogin() {
    const { user, isLoggedIn, isAuthLoading } = useAuth();
    const [migrationResult, setMigrationResult] = useState(null);
    const [isMigrating, setIsMigrating] = useState(false);

    useEffect(() => {
        if (isAuthLoading) return undefined;

        if (!isLoggedIn || !user?.id) {
            const result = prepareLegacyDataForGuest();
            setMigrationResult(result);
            setIsMigrating(false);
            window.dispatchEvent(new CustomEvent('deliverytracker:legacy-data-prepared', { detail: { userId: 'device' } }));
            return undefined;
        }

        let isMounted = true;
        setIsMigrating(true);

        migrateLocalDataToServer(user.id)
            .then((result) => {
                if (!isMounted) return;
                setMigrationResult(result);
                window.dispatchEvent(new CustomEvent('deliverytracker:legacy-data-prepared', { detail: { userId: user.id } }));
                if (!result.success) {
                    console.error('[Migration] 로컬 데이터 분류 준비 실패:', result.error);
                }

                // 첫 로그인 시 기기 공용 미분류 데이터의 소유권을 사용자가 직접 결정합니다.
                // 이 단계는 로컬 저장소 귀속만 수행하며 Supabase 업로드는 하지 않습니다.
                reserveUnclassifiedLegacyDataForAccount(user.id);
                const promptKey = `guest_attribution_prompted:v2:${user.id}`;
                const legacyEntries = getUnclassifiedLegacyData(user.id);
                const legacySettings = getUnclassifiedLegacySettings(user.id);
                let wasPrompted = false;
                try {
                    wasPrompted = localStorage.getItem(promptKey) === 'true';
                } catch (storageError) {
                    console.warn('[Migration] 귀속 안내 상태 확인 실패:', storageError);
                }

                if (!wasPrompted && (legacyEntries.length > 0 || legacySettings)) {
                    try {
                        localStorage.setItem(promptKey, 'true');
                    } catch (storageError) {
                        console.warn('[Migration] 귀속 안내 상태 저장 실패:', storageError);
                    }

                    const detail = [
                        legacyEntries.length > 0 ? `장부 ${legacyEntries.length}건` : '',
                        legacySettings ? '앱 설정' : '',
                    ].filter(Boolean).join(' 및 ');
                    const accepted = window.confirm(
                        `이 기기에 이전 버전의 기존 데이터(${detail})가 있습니다.\n\n현재 로그인한 계정에 귀속하시겠습니까?\n귀속은 이 기기의 계정별 저장소에만 적용되며 서버로 전송되지 않습니다. 기존 계정 설정은 덮어쓰지 않습니다.`
                    );

                    if (accepted) {
                        const attribution = importUnclassifiedLegacyDataToAccount(user.id);
                        window.dispatchEvent(new CustomEvent('deliverytracker:legacy-data-prepared', { detail: { userId: user.id } }));
                        console.info('[Migration] 사용자가 기존 기기 데이터를 현재 계정에 로컬 귀속했습니다:', attribution);
                    }
                }
            })
            .catch((error) => {
                if (!isMounted) return;
                setMigrationResult({ success: false, error: error.message });
                window.dispatchEvent(new CustomEvent('deliverytracker:legacy-data-prepared', { detail: { userId: user.id } }));
                console.error('[Migration] 로컬 데이터 분류 준비 실패:', error);
            })
            .finally(() => {
                if (isMounted) setIsMigrating(false);
            });

        return () => { isMounted = false; };
    }, [isAuthLoading, isLoggedIn, user?.id]);

    return { migrationResult, isMigrating };
}
