// Prepares legacy local records safely after the authenticated account is known.
// Legacy records are classified locally only; this hook never uploads them.
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { migrateLocalDataToServer } from '../utils/migration';

export function useMigrationOnLogin() {
    const { user, isLoggedIn, isAuthLoading } = useAuth();
    const [migrationResult, setMigrationResult] = useState(null);
    const [isMigrating, setIsMigrating] = useState(false);

    useEffect(() => {
        if (isAuthLoading || !isLoggedIn || !user?.id) {
            setMigrationResult(null);
            setIsMigrating(false);
            return undefined;
        }

        let isMounted = true;
        setIsMigrating(true);

        migrateLocalDataToServer(user.id)
            .then((result) => {
                if (!isMounted) return;
                setMigrationResult(result);
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
