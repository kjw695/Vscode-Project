// src/hooks/useMigrationOnLogin.js
//
// 로그인이 감지되면 자동으로 마이그레이션을 1회 실행하는 훅입니다.
// App.js 최상단에서 한 줄만 호출하면 됩니다: useMigrationOnLogin();
//
// 새로 만드는 파일이라 기존 코드에는 영향이 없습니다.

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { migrateLocalDataToServer } from '../utils/migration';

export function useMigrationOnLogin() {
    const { user, isLoggedIn } = useAuth();
    const [migrationResult, setMigrationResult] = useState(null);
    const [isMigrating, setIsMigrating] = useState(false);

    useEffect(() => {
        if (!isLoggedIn || !user) return;

        let isMounted = true;
        setIsMigrating(true);

        migrateLocalDataToServer(user.id).then(result => {
            if (!isMounted) return;
            setIsMigrating(false);
            setMigrationResult(result);

            if (!result.success) {
                // 실패해도 로컬 데이터는 그대로 남아있으므로 사용자는 데이터를
                // 잃지 않습니다. 다음 로그인 시(또는 새로고침 시) 다시 시도됩니다.
                console.error('[Migration] 자동 마이그레이션 실패, 다음 시도에서 재시도됩니다:', result.error);
            } else if (result.added > 0) {
                console.log(`[Migration] ${result.added}건 업로드 완료, ${result.skipped}건 중복 제외`);
            }
        });

        return () => { isMounted = false; };
    }, [isLoggedIn, user]);

    return { migrationResult, isMigrating };
}