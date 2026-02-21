import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { ChevronLeft, Save, Target } from 'lucide-react';

function GoalSettingsView({ onBack, isDarkMode, goalAmount, onSaveGoal }) {
    const [inputValue, setInputValue] = useState('');
    
    // ✨ 커서 위치를 기억하고 조작할 수 있는 투명한 끈(ref) 2개
    const inputRef = useRef(null);
    const cursorRef = useRef(null);

    useEffect(() => {
        if (goalAmount) {
            setInputValue(goalAmount.toLocaleString());
        }
    }, [goalAmount]);

    // ✨ 1. 콤마(,)를 유령처럼 무시하고 건너뛰게 만드는 함수
    const handleKeyDown = (e) => {
        const input = e.target;
        const cursorPos = input.selectionStart;

        // 드래그해서 여러 글자를 선택한 상태라면 이 기능을 끕니다.
        if (input.selectionStart !== input.selectionEnd) return;

        // 백스페이스(지우기)를 눌렀는데 바로 앞이 콤마라면? (커서를 콤마 앞으로 휙 넘김)
        if (e.key === 'Backspace' && input.value[cursorPos - 1] === ',') {
            input.setSelectionRange(cursorPos - 1, cursorPos - 1);
        }
        // Delete(오른쪽 지우기)를 눌렀는데 바로 다음이 콤마라면?
        else if (e.key === 'Delete' && input.value[cursorPos] === ',') {
            input.setSelectionRange(cursorPos + 1, cursorPos + 1);
        }
        // 왼쪽 화살표를 누를 때 콤마 훌쩍 넘어가기
        else if (e.key === 'ArrowLeft' && input.value[cursorPos - 1] === ',') {
            e.preventDefault();
            input.setSelectionRange(cursorPos - 2, cursorPos - 2);
        }
        // 오른쪽 화살표를 누를 때 콤마 훌쩍 넘어가기
        else if (e.key === 'ArrowRight' && input.value[cursorPos] === ',') {
            e.preventDefault();
            input.setSelectionRange(cursorPos + 2, cursorPos + 2);
        }
    };

    // ✨ 2. 숫자가 바뀔 때 커서 위치와 '0' 유지 로직을 처리합니다.
    const handleChange = (e) => {
        const input = e.target;
        const originalValue = input.value;
        const selectionStart = input.selectionStart;

        // 커서 앞쪽에 있는 '순수 숫자'의 개수만 셉니다.
        const digitsBeforeCursor = originalValue.slice(0, selectionStart).replace(/[^0-9]/g, '').length;
        
        // 순수 숫자만 추출
        let rawValue = originalValue.replace(/[^0-9]/g, '');

        if (rawValue !== '') {
            // 남은 숫자가 전부 0일 때(예: "000000")는 지우지 않고 보존
            if (!/^0+$/.test(rawValue)) {
                rawValue = rawValue.replace(/^0+/, ''); 
            }

            // 직접 3자리마다 콤마를 찍어줍니다.
            const newValue = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            
            // 바뀐 텍스트에서 새 커서 위치를 정확히 찾습니다.
            let newCursorPos = 0;
            let digitsCounted = 0;
            for (let i = 0; i < newValue.length; i++) {
                if (digitsCounted === digitsBeforeCursor) break;
                if (newValue[i] !== ',') digitsCounted++;
                newCursorPos++;
            }

            cursorRef.current = newCursorPos; 
            setInputValue(newValue);
        } else {
            cursorRef.current = 0;
            setInputValue('');
        }
    };

    // ✨ 3. 화면이 우리 눈에 보여지기 직전(찰나의 순간)에 커서를 제자리에 꽂아 넣습니다.
    useLayoutEffect(() => {
        if (inputRef.current && cursorRef.current !== null) {
            inputRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
            cursorRef.current = null; // 사용 후 메모장 초기화
        }
    }, [inputValue]);

    const handleSave = () => {
        const numValue = Number(inputValue.replace(/,/g, ''));
        if (numValue > 0) {
            onSaveGoal(numValue);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto pb-20">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className={`p-2 -ml-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'} transition-colors`}>
                    <ChevronLeft size={28} />
                </button>
                <h2 className={`text-2xl font-bold ml-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>목표 금액 설정</h2>
            </div>

            <div className={`p-5 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        <Target size={24} />
                    </div>
                    <div>
                        <h3 className={`font-bold text-lg ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>한 달 목표 금액</h3>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>이번 달 달성하고 싶은 목표 수익을 입력해주세요.</p>
                    </div>
                </div>

                <div className="mt-6 relative">
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        value={inputValue}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown} 
                        className={`w-full text-right text-2xl font-black py-4 px-12 rounded-xl outline-none transition-all border-2
                            ${isDarkMode
                                ? 'bg-gray-900 border-gray-700 focus:border-blue-500 text-white'
                                : 'bg-gray-50 border-gray-200 focus:border-blue-500 text-gray-900'
                            }`}
                        placeholder="0"
                    />
                    <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>원</span>
                </div>

                <button
                    onClick={handleSave}
                    disabled={!inputValue || inputValue === '0'}
                    className={`w-full mt-6 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-md
                        ${!inputValue || inputValue === '0'
                            ? (isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400')
                            : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                        }`}
                >
                    <Save size={20} />
                    저장하기
                </button>
            </div>
        </div>
    );
}

export default GoalSettingsView;