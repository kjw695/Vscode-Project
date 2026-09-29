import React from 'react';
import { ArrowRightLeft } from 'lucide-react';

export default function ExchangeTab({ isDarkMode }) {
    return (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-full text-indigo-500">
                <ArrowRightLeft size={28} />
            </div>
            <h4 className="font-bold text-sm">휴무 교환 마켓 오픈 준비중</h4>
            <p className="text-xs text-gray-400 px-4 leading-relaxed">
                이미 배정된 날짜를 팀원과 서로 맞교환할 수 있는 장터 기능이 곧 업데이트됩니다.
            </p>
        </div>
    );
}