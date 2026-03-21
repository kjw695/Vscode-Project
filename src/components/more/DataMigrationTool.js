import React from 'react';
import { RefreshCw } from 'lucide-react';

const DataMigrationTool = ({ isDarkMode }) => {
    const handleManualMigration = () => {
        const saved = localStorage.getItem('deliveryEntries');
        if (!saved) {
            alert("변환할 데이터가 없습니다.");
            return;
        }
        
        const data = JSON.parse(saved);
        let isModified = false; // 전체 파일 저장 여부
        
        const migratedData = data.map(entry => {
            let entryChanged = false; // 이 항목에서 찌꺼기가 지워졌는지 확인
            let newCustomItems = entry.customItems ? [...entry.customItems] : [];
            const baseUnitPrice = Number(entry.unitPrice) || 0;

            const checkAndMigrateIncome = (key, defaultName) => {
                // 값이 0이든 뭐든, 옛날 '키(key)' 자체가 존재하면 무조건 청소 대상!
                if (entry[key] !== undefined && entry[key] !== null) {
                    // 혹시 신버전 상자에 안 담겨있으면 담아줍니다.
                    if (Number(entry[key]) > 0 && !newCustomItems.some(item => item.key === key)) {
                        newCustomItems.push({ type: 'income', key: key, name: defaultName, count: Number(entry[key]), unitPrice: baseUnitPrice });
                    }
                    // ✨ 핵심: 찌꺼기 껍데기 완전 삭제!
                    delete entry[key]; 
                    entryChanged = true;
                }
            };

            const checkAndMigrateExpense = (key, defaultName) => {
                if (entry[key] !== undefined && entry[key] !== null) {
                    if (Number(entry[key]) > 0 && !newCustomItems.some(item => item.key === key)) {
                        newCustomItems.push({ type: 'expense', key: key, name: defaultName, amount: Number(entry[key]) });
                    }
                    // ✨ 핵심: 찌꺼기 껍데기 완전 삭제!
                    delete entry[key]; 
                    entryChanged = true;
                }
            };

            // 검사할 구버전 찌꺼기 항목들 싹 다 투입
            checkAndMigrateIncome('deliveryCount', '배송');
            checkAndMigrateIncome('returnCount', '반품');
            checkAndMigrateIncome('deliveryInterruptionAmount', '중단');
            checkAndMigrateIncome('freshBagCount', '프레시백');

            checkAndMigrateExpense('penaltyAmount', '패널티');
            checkAndMigrateExpense('industrialAccidentCost', '산재');
            checkAndMigrateExpense('fuelCost', '유류비');
            checkAndMigrateExpense('maintenanceCost', '유지보수비');
            checkAndMigrateExpense('vatAmount', '부가세');
            checkAndMigrateExpense('incomeTaxAmount', '종합소득세');
            checkAndMigrateExpense('taxAccountantFee', '세무사 비용');

            if (entryChanged) {
                isModified = true;
                return { ...entry, customItems: newCustomItems };
            }
            return entry; // 찌꺼기가 없었으면 그대로 패스
        });

        if (isModified) {
            localStorage.setItem('deliveryEntries', JSON.stringify(migratedData));
            alert("✅ 구버전 찌꺼기 데이터가 완벽하게 청소 및 최신화되었습니다!\n앱을 새로고침합니다.");
            window.location.reload();
        } else {
            alert("👍 이미 찌꺼기 없이 완벽하게 최적화된 상태입니다.");
        }
    };

    return (
        <div className="space-y-3">
            <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                데이터 최적화 (일회성 도구)
            </h3>
            <button 
                onClick={handleManualMigration}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${
                    isDarkMode ? 'bg-indigo-900/20 border-indigo-800 hover:bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100 text-indigo-700'
                }`}
            >
                <div className="flex items-center">
                    <RefreshCw size={20} className="mr-3" />
                    <div className="text-left">
                        <span className="font-semibold block">구버전 데이터 최신화</span>
                        <span className="text-xs opacity-80">과거 데이터를 최신 규격으로 한 번에 변환합니다.</span>
                    </div>
                </div>
            </button>
        </div>
    );
};

export default DataMigrationTool;