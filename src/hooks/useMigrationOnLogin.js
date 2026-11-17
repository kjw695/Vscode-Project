// Prepares legacy local records safely after the authenticated account is known.
// Legacy records are classified locally only; this hook never uploads them.
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { migrateLocalDataToServer, prepareLegacyDataForGuest } from '../utils/migration';

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
            })
            .catch((error) => {
                if (!isMounted) return;
                setMigrationResult({ success: false, error: error.message });
                console.error('[Migration] 로컬 데이터 분류 준비 실패:', error);
            })
            .finally(() => {
                if (isMounted) setIsMigrating(false);
            });

        return () => { isMounted = false; };
    }, [isAuthLoading, isLoggedIn, user?.id]);

    return { migrationResult, isMigrating };
}
