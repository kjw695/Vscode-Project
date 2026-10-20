// 예시: src/admin/pages/RouteManager.jsx
import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function RouteManager({ onBack }) {
    return (
        <div className="w-full h-full flex flex-col bg-gray-50">
            <header className="bg-white px-6 py-4 flex items-center shadow-sm border-b">
                <button onClick={onBack} className="p-2 -ml-2 mr-2 text-gray-600 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-xl font-black text-gray-800">노선 및 팀 관리 (개발 예정)</h1>
            </header>
            <div className="flex-1 flex items-center justify-center text-gray-400 font-bold">
                이 화면은 다음 단계에서 상세 구현됩니다.
            </div>
        </div>
    );
}