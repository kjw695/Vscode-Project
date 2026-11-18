// Prepares legacy local records safely after the authenticated account is known.
// Legacy records are classified locally only; this hook never uploads them.
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { migrateLocalDataToServer, reserveUnclassifiedLegacyDataForAccount, prepareLegacyDataForGuest } from '../utils/migration';

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

                // 첫 로그인 계정은 검토 권한만 예약합니다.
                // 로그인 직후 브라우저 확인창으로 사용자를 막지 않고,
                // 계정 관리 화면의 안내 카드에서 원할 때 직접 귀속하도록 합니다.
                reserveUnclassifiedLegacyDataForAccount(user.id);
                window.dispatchEvent(new CustomEvent('deliverytracker:legacy-data-prepared', { detail: { userId: user.id } }));

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
