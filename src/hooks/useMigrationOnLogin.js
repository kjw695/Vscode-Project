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
        let isRunning = false;
        let retryRequested = false;

        const runMigration = async () => {
            if (!isMounted) return;
            if (isRunning) {
                retryRequested = true;
                return;
            }

            isRunning = true;
            setIsMigrating(true);

            try {
                const result = await migrateLocalDataToServer(user.id);
                if (!isMounted) return;

                setMigrationResult(result);
                window.dispatchEvent(new CustomEvent('deliverytracker:legacy-data-prepared', { detail: { userId: user.id } }));

                // 서버 소유권 확인이 실패한 상태에서는 새 데이터의 귀속을 제안하지 않습니다.
                // 네트워크가 복구되면 online 이벤트에서 다시 확인합니다.
                if (!result.success) {
                    console.error('[Migration] 로컬 데이터 분류 준비 실패:', result.error);
                    return;
                }

                // 첫 로그인 계정은 검토 권한만 예약합니다. 실제 계정 귀속은
                // 아래 확인창에서 사용자가 동의한 경우에만 수행합니다.
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
                    const detail = [
                        legacyEntries.length > 0 ? `장부 ${legacyEntries.length}건` : '',
                        legacySettings ? '앱 설정' : '',
                    ].filter(Boolean).join(' 및 ');
                    const accepted = window.confirm(
                        `이 기기에 이전 버전의 기존 데이터(${detail})가 있습니다.\n\n현재 로그인한 계정에 귀속하시겠습니까?\n귀속은 이 기기의 계정별 저장소에만 적용되며 서버로 전송되지 않습니다. 기존 계정 설정은 덮어쓰지 않습니다.`
                    );

                    // 확인창이 닫힌 뒤에 안내 완료 상태를 저장합니다.
                    // '나중에'를 선택해도 계정 관리 화면의 기존 장부 카드에서 다시 결정할 수 있습니다.
                    try {
                        localStorage.setItem(promptKey, 'true');
                    } catch (storageError) {
                        console.warn('[Migration] 귀속 안내 상태 저장 실패:', storageError);
                    }

                    if (accepted && isMounted) {
                        const attribution = importUnclassifiedLegacyDataToAccount(user.id);
                        window.dispatchEvent(new CustomEvent('deliverytracker:legacy-data-prepared', { detail: { userId: user.id } }));
                        console.info('[Migration] 사용자가 기존 기기 데이터를 현재 계정에 로컬 귀속했습니다:', attribution);
                        // DeliveryContext가 귀속된 계정 저장소를 다시 읽도록 앱을 새로 불러옵니다.
                        window.location.reload();
                    }
                }
            } catch (error) {
                if (!isMounted) return;
                setMigrationResult({ success: false, error: error.message });
                window.dispatchEvent(new CustomEvent('deliverytracker:legacy-data-prepared', { detail: { userId: user.id } }));
                console.error('[Migration] 로컬 데이터 분류 준비 실패:', error);
            } finally {
                isRunning = false;
                if (isMounted) setIsMigrating(false);
                if (isMounted && retryRequested) {
                    retryRequested = false;
                    runMigration();
                }
            }
        };

        // 첫 진입에서 확인하고, 요청 도중 네트워크가 복구된 경우도 다시 시도합니다.
        runMigration();
        const handleOnline = () => { runMigration(); };
        window.addEventListener('online', handleOnline);

        return () => {
            isMounted = false;
            window.removeEventListener('online', handleOnline);
        };
    }, [isAuthLoading, isLoggedIn, user?.id]);

    return { migrationResult, isMigrating };
}
