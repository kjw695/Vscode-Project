import React from 'react';
import { ArrowLeft, Calculator } from 'lucide-react';

export default function PayrollManager({ onBack }) {
    return (
        <div className="w-full h-full flex flex-col bg-gray-50 font-sans">
            <header className="bg-white px-6 py-4 flex items-center shadow-sm border-b shrink-0">
                <button onClick={onBack} className="p-2 -ml-2 mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
                    <Calculator size={24} className="text-emerald-600"/> 실적 및 급여 정산
                </h1>
            </header>
            
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 font-bold p-6 text-center">
                <Calculator size={48} className="mb-4 text-gray-200" />
                <p>배송 실적 입력 및 정산 화면이 이곳에 구현될 예정입니다.</p>
            </div>
        </div>
    );
}