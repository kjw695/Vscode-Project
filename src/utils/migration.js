// src/utils/migration.js
//
// ⚠️ 가장 조심해야 하는 파일입니다.
// 기존 localStorage 데이터를 Supabase 서버로 옮기는 로직을 담당합니다.
//
// 지키는 안전 원칙 4가지:
// 1. 로컬 데이터는 절대 먼저 지우지 않는다 (서버 업로드 성공 확인 후에만, 그것도 즉시 삭제하지 않고 백업 키로 보관)
// 2. 업로드는 추가(append)만, 기존 서버 데이터를 덮어쓰지 않는다 (중복 검사 후 병합)
// 3. 중간에 실패해도 다시 시도하면 중복 없이 이어서 처리된다 (멱등성)
// 4. 마이그레이션 시작 전, 로컬 데이터를 별도 키로 스냅샷 저장한다 (만약을 위한 원본 보존)

import { supabase } from '../lib/supabaseClient';

const LOCAL_ENTRIES_KEY = 'deliveryEntries';
const LOCAL_SETTINGS_KEY = 'appSettings';
const SNAPSHOT_PREFIX = 'migration_snapshot_';
const MIGRATION_DONE_FLAG = 'migration_completed_v1';

/**
 * 마이그레이션이 이미 끝났는지 확인합니다.
 * (로그인할 때마다 매번 다시 시도하지 않도록)
 */
function isMigrationAlreadyDone() {
    return localStorage.getItem(MIGRATION_DONE_FLAG) === 'true';
}

/**
 * [안전원칙 4] 마이그레이션 시작 전, 현재 로컬 데이터를 그대로
 * 별도 키에 스냅샷으로 남겨둡니다. 이 스냅샷은 마이그레이션 성공 여부와
 * 상관없이 사용자가 명시적으로 정리하기 전까지는 지우지 않습니다.
 */
function createLocalSnapshot() {
    const timestamp = new Date().toISOString();
    const entries = localStorage.getItem(LOCAL_ENTRIES_KEY);
    const settings = localStorage.getItem(LOCAL_SETTINGS_KEY);

    const snapshotKey = `${SNAPSHOT_PREFIX}${timestamp}`;
    localStorage.setItem(snapshotKey, JSON.stringify({
        entries: entries ? JSON.parse(entries) : [],
        settings: settings ? JSON.parse(settings) : {},
        createdAt: timestamp,
    }));

    return snapshotKey;
}

/**
 * 서버에 이미 존재하는 entry와 중복인지 판단합니다.
 * date + type + customItems 내용이 같으면 같은 데이터로 간주합니다.
 * (DeliveryContext.js의 isDuplicateEntry와 동일한 기준을 서버 데이터에도 적용)
 */
function isDuplicateOfServerEntry(localEntry, serverEntries) {
    return serverEntries.some(serverEntry =>
        serverEntry.date === localEntry.date &&
        serverEntry.type === localEntry.type &&
        JSON.stringify(serverEntry.custom_items || []) === JSON.stringify(localEntry.customItems || [])
    );
}

/**
 * 로컬의 entry 객체를 Supabase entries 테이블 컬럼명에 맞게 변환합니다.
 * (camelCase -> snake_case, id는 서버가 새로 발급하므로 제외)
 */
function toServerEntryFormat(localEntry, userId) {
    return {
        user_id: userId,
        date: localEntry.date,
        type: localEntry.type,
        unit_price: localEntry.unitPrice || 0,
        round: localEntry.round || 0,
        memo: localEntry.memo || null,
        custom_items: localEntry.customItems || [],
        is_edited: localEntry.isEdited || false,
        created_at: localEntry.timestamp || new Date().toISOString(),
    };
}

/**
 * 메인 함수: 로그인 직후 호출됩니다.
 * 이미 마이그레이션했다면 아무것도 하지 않고 false를 반환합니다.
 *
 * @param {string} userId - 로그인한 사용자의 auth uid
 * @returns {Promise<{success: boolean, added: number, skipped: number, error?: string}>}
 */
export async function migrateLocalDataToServer(userId) {
    if (!userId) {
        return { success: false, added: 0, skipped: 0, error: '사용자 정보가 없습니다.' };
    }

    if (isMigrationAlreadyDone()) {
        return { success: true, added: 0, skipped: 0, error: null };
    }

    // [안전원칙 4] 시작 전 스냅샷 먼저 생성 — 이후 어떤 단계에서 실패해도
    // 이 스냅샷은 그대로 남아있어 원본 복구가 가능합니다.
    const snapshotKey = createLocalSnapshot();
    console.log('[Migration] 로컬 데이터 스냅샷 생성됨:', snapshotKey);

    try {
        const rawEntries = localStorage.getItem(LOCAL_ENTRIES_KEY);
        const localEntries = rawEntries ? JSON.parse(rawEntries) : [];

        const rawSettings = localStorage.getItem(LOCAL_SETTINGS_KEY);
        const localSettings = rawSettings ? JSON.parse(rawSettings) : null;

        if (localEntries.length === 0 && !localSettings) {
            // 옮길 데이터가 없으면 (신규 사용자 등) 바로 완료 처리
            localStorage.setItem(MIGRATION_DONE_FLAG, 'true');
            return { success: true, added: 0, skipped: 0, error: null };
        }

        // [안전원칙 2] 먼저 서버에 이미 있는 데이터를 조회해서 중복을 피합니다.
        const { data: existingEntries, error: fetchError } = await supabase
            .from('entries')
            .select('date, type, custom_items')
            .eq('user_id', userId);

        if (fetchError) {
            throw new Error(`서버 기존 데이터 조회 실패: ${fetchError.message}`);
        }

        const serverEntries = existingEntries || [];

        // 중복이 아닌 항목만 추려냅니다.
        const entriesToUpload = localEntries
            .filter(entry => !isDuplicateOfServerEntry(entry, serverEntries))
            .map(entry => toServerEntryFormat(entry, userId));

        const skippedCount = localEntries.length - entriesToUpload.length;
        let addedCount = 0;

        // [안전원칙 2, 3] insert만 사용 (upsert/update 아님) — 기존 서버 데이터를
        // 건드리지 않고 새로운 것만 추가. 100건씩 나눠서 업로드 (한 번에 너무 많이
        // 보내면 실패 시 전체가 롤백되는 위험을 줄이기 위함)
        const BATCH_SIZE = 100;
        for (let i = 0; i < entriesToUpload.length; i += BATCH_SIZE) {
            const batch = entriesToUpload.slice(i, i + BATCH_SIZE);
            const { error: insertError } = await supabase.from('entries').insert(batch);

            if (insertError) {
                // 일부만 업로드된 상태에서 실패 - 마이그레이션 완료 플래그를 세우지 않아서
                // 다음 로그인 시 재시도됩니다. 이미 들어간 것들은 위 중복검사 로직 덕분에
                // 다시 중복으로 들어가지 않습니다.
                throw new Error(`데이터 업로드 중 오류 (${addedCount}건 업로드 후 중단): ${insertError.message}`);
            }
            addedCount += batch.length;
        }

        // 설정값도 마찬가지로, 서버에 이미 있으면 덮어쓰지 않고 없을 때만 생성합니다.
        if (localSettings) {
            const { data: existingSettings } = await supabase
                .from('settings')
                .select('user_id')
                .eq('user_id', userId)
                .maybeSingle();

            if (!existingSettings) {
                const { error: settingsError } = await supabase.from('settings').insert({
                    user_id: userId,
                    income_config: localSettings.incomeConfig || null,
                    expense_config: localSettings.expenseConfig || null,
                    goal_amount: localSettings.goalAmount || 7000000,
                    monthly_start_day: localSettings.monthlyPeriod?.startDay || 26,
                    monthly_end_day: localSettings.monthlyPeriod?.endDay || 25,
                    favorite_unit_prices: localSettings.favoriteUnitPrices || [700],
                    dashboard_config: localSettings.dashboardConfig || null,
                    selected_insurance: localSettings.selectedInsurance || null,
                    selected_items_for_average: localSettings.selectedItemsForAverage || ['배송', '반품'],
                });

                if (settingsError) {
                    console.warn('[Migration] 설정값 업로드 실패 (entries는 정상 완료됨):', settingsError.message);
                    // 설정값 실패는 치명적이지 않으므로 전체 실패로 처리하지 않습니다.
                }
            }
        }

        // 모든 단계가 끝난 뒤에만 완료 플래그를 세웁니다.
        localStorage.setItem(MIGRATION_DONE_FLAG, 'true');

        // [안전원칙 1] 로컬 원본 데이터(deliveryEntries, appSettings)는
        // 여기서도 지우지 않습니다. 사용자가 충분히 안정성을 확인한 뒤
        // 별도 "정리하기" 버튼을 눌러야만 지워지도록 별도 함수로 분리했습니다.

        return { success: true, added: addedCount, skipped: skippedCount, error: null };
    } catch (err) {
        console.error('[Migration] 마이그레이션 실패:', err);
        return { success: false, added: 0, skipped: 0, error: err.message };
    }
}

/**
 * 마이그레이션이 잘 끝났고 충분히 확인된 뒤, 사용자가 명시적으로
 * "로컬 백업 데이터 정리하기"를 눌렀을 때만 호출되어야 하는 함수입니다.
 * 절대로 마이그레이션 직후 자동으로 호출하지 않습니다.
 */
export function clearLocalEntriesAfterConfirmedSync() {
    localStorage.removeItem(LOCAL_ENTRIES_KEY);
    localStorage.removeItem(LOCAL_SETTINGS_KEY);
    console.log('[Migration] 로컬 원본 데이터 정리 완료 (스냅샷은 유지됨)');
}

/**
 * 비상시 복구용: 생성된 모든 스냅샷 목록을 보여줍니다.
 */
export function listSnapshots() {
    const snapshots = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(SNAPSHOT_PREFIX)) {
            snapshots.push(key);
        }
    }
    return snapshots.sort().reverse(); // 최신 순
}

/**
 * 비상시 복구용: 특정 스냅샷 내용을 그대로 반환합니다.
 * (필요하면 이 내용을 다시 entries 테이블에 수동으로 넣을 수 있습니다)
 */
export function getSnapshot(snapshotKey) {
    const raw = localStorage.getItem(snapshotKey);
    return raw ? JSON.parse(raw) : null;
}