import React, { useState } from 'react';
import { ArrowLeft, ArrowUp, ArrowDown, Check, Eye, EyeOff, ChevronsUp, ChevronsDown } from 'lucide-react';

const DashboardSettingsView = ({ isDarkMode, onBack, config, onSave }) => {
    // ✨ 1줄과 2줄 상태를 분리해서 관리
    const [row1Items, setRow1Items] = useState(config.filter(c => c.row === 1 || !c.row));
    const [row2Items, setRow2Items] = useState(config.filter(c => c.row === 2));

    // 같은 줄 안에서 위아래 순서 변경
    const moveItem = (list, setList, index, direction) => {
        if ((direction === -1 && index === 0) || (direction === 1 && index === list.length - 1)) return;
        const newList = [...list];
        const temp = newList[index + direction];
        newList[index + direction] = newList[index];
        newList[index] = temp;
        setList(newList);
    };

    // 눈 아이콘 (끄기/켜기)
    const toggleVisibility = (list, setList, index) => {
        const newList = [...list];
        newList[index].isVisible = !newList[index].isVisible;
        setList(newList);
    };

    // ✨ 다른 줄(1줄 <-> 2줄)로 이동시키는 함수
    const moveToOtherRow = (item, fromRow) => {
        if (fromRow === 1) {
            setRow1Items(row1Items.filter(i => i.id !== item.id));
            setRow2Items([...row2Items, { ...item, row: 2 }]);
        } else {
            setRow2Items(row2Items.filter(i => i.id !== item.id));
            setRow1Items([...row1Items, { ...item, row: 1 }]);
        }
    };

    // 저장 버튼 클릭 시 1줄과 2줄 데이터를 합쳐서 App.js로 보냄
    const handleSave = () => {
        const finalConfig = [
            ...row1Items.map(i => ({ ...i, row: 1 })),
            ...row2Items.map(i => ({ ...i, row: 2 }))
        ];
        onSave(finalConfig);
    };

    // ✨ 화면에 리스트를 그려주는 템플릿 함수 (1줄, 2줄 동일하게 사용)
    const renderList = (items, setItems, rowNum) => (
        <div className="space-y-2 min-h-[50px] p-2 rounded-xl bg-gray-50 dark:bg-gray-800/30 border border-dashed border-gray-200 dark:border-gray-700">
            {items.length === 0 && (
                <div className="text-center text-sm py-4 text-gray-400 dark:text-gray-500">이 줄에는 카드가 없습니다.</div>
            )}
            {items.map((item, index) => (
                <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} shadow-sm`}>
                    <div className="flex items-center space-x-3">
                        <button onClick={() => toggleVisibility(items, setItems, index)} className={`p-1.5 rounded-full ${item.isVisible ? (isDarkMode ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-600') : (isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400')}`}>
                            {item.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                        <span className={`text-base font-bold ${item.isVisible ? (isDarkMode ? 'text-white' : 'text-gray-800') : 'line-through text-gray-400'}`}>
                            {item.label}
                        </span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <button onClick={() => moveItem(items, setItems, index, -1)} disabled={index === 0} className={`p-1.5 rounded-md ${index === 0 ? 'opacity-30' : (isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600')}`}><ArrowUp size={18} /></button>
                        <button onClick={() => moveItem(items, setItems, index, 1)} disabled={index === items.length - 1} className={`p-1.5 rounded-md ${index === items.length - 1 ? 'opacity-30' : (isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600')}`}><ArrowDown size={18} /></button>
                        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                        <button onClick={() => moveToOtherRow(item, rowNum)} className={`p-1.5 rounded-md flex items-center ${isDarkMode ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-100 text-blue-600'}`}>
                            {rowNum === 1 ? <><ChevronsDown size={18} /><span className="text-xs font-bold ml-1">2줄로</span></> : <><ChevronsUp size={18} /><span className="text-xs font-bold ml-1">1줄로</span></>}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );

   return (
        <div className="flex flex-col h-full w-full">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    <button onClick={onBack} className={`p-2 -ml-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'}`}><ArrowLeft size={24} /></button>
                    <h2 className="text-xl font-bold ml-2">홈 화면 설정</h2>
                </div>
                <button onClick={handleSave} className={`p-2 px-4 rounded-full font-bold flex items-center shadow-md active:scale-95 transition-transform ${isDarkMode ? 'bg-yellow-500 text-gray-900' : 'bg-yellow-400 text-yellow-900'}`}>
                    <Check size={18} className="mr-1" /> 저장
                </button>
            </div>
            
            <div className="overflow-y-auto pb-10 space-y-6">
                {/* ✨ 1번 줄 영역 */}
                <div>
                    <h3 className={`font-bold mb-2 ml-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>[ 1번 줄 ] <span className="text-xs font-normal text-gray-500">최대 4개 권장</span></h3>
                    {renderList(row1Items, setRow1Items, 1)}
                </div>

                {/* ✨ 2번 줄 영역 */}
                <div>
                    <h3 className={`font-bold mb-2 ml-1 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>[ 2번 줄 ] <span className="text-xs font-normal text-gray-500">최대 4개 권장</span></h3>
                    {renderList(row2Items, setRow2Items, 2)}
                </div>
            </div>
        </div>
    );
}

export default DashboardSettingsView;