import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Sparkles, Lightbulb, ArrowUp } from 'lucide-react';
import Fuse from 'fuse.js';

const SearchView = ({ entries, itemLabels, isDarkMode, onEdit }) => {
    const [inputText, setInputText] = useState('');
    const [query, setQuery] = useState('');
    const [showOnlyMemos, setShowOnlyMemos] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

    // 타자 칠 때 한글 씹힘 방지
    useEffect(() => {
        const timer = setTimeout(() => {
            setQuery(inputText);
        }, 150);
        return () => clearTimeout(timer);
    }, [inputText]);

    // ✨ [추가] 스크롤 위치를 감지해서 300px 이상 내려가면 버튼을 띄우는 로직
    useEffect(() => {
        const scrollContainer = document.querySelector('.overflow-y-auto'); // App.js의 스크롤 영역 찾기
        if (!scrollContainer) return;

        const handleScroll = () => {
            setShowScrollTop(scrollContainer.scrollTop > 300);
        };

        scrollContainer.addEventListener('scroll', handleScroll);
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, []);

    // ✨ [추가] 누르면 맨 위로 부드럽게 스크롤되는 함수
    const scrollToTop = () => {
        const scrollContainer = document.querySelector('.overflow-y-auto');
        if (scrollContainer) {
            scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // ✨ 중복 방지 기능이 탑재된 완벽한 계산기
    const calculateEntryStats = (entry, itemLabels) => {
        const baseUnitPrice = Number(entry.unitPrice) || 0;
        let totalRevenue = 0;
        let totalExpense = 0;
        const processedKeys = new Set(); // 중복 검사기

        // 1. 커스텀 추가 항목 먼저 계산
        if (entry.customItems && Array.isArray(entry.customItems)) {
            entry.customItems.forEach(item => {
                if (item.key) processedKeys.add(item.key);
                
                const amount = Number(item.amount) || 0;
                const count = Number(item.count) || 1;
                // 단가가 지정되어 있으면 수량*단가, 아니면 총금액(amount)
                const finalAmount = item.type === 'expense' 
                    ? amount 
                    : (item.unitPrice !== undefined ? (count * Number(item.unitPrice)) : amount);

                if (item.type === 'income') totalRevenue += finalAmount;
                else if (item.type === 'expense') totalExpense += finalAmount;
            });
        }

        // 2. 기본 수익 항목 계산 (커스텀에서 이미 계산된 건 패스!)
        const incomeKeys = ['deliveryCount', 'returnCount', 'deliveryInterruptionAmount', 'freshBagCount'];
        incomeKeys.forEach(key => {
            const count = Number(entry[key]) || 0;
            if (count > 0 && !processedKeys.has(key)) {
                totalRevenue += count * baseUnitPrice;
            }
        });

        // 3. 레거시 지출 항목 계산 (커스텀에서 이미 계산된 건 패스!)
        const legacyExpenseKeys = ['penaltyAmount', 'industrialAccidentCost', 'fuelCost', 'maintenanceCost', 'vatAmount', 'incomeTaxAmount', 'taxAccountantFee'];
        legacyExpenseKeys.forEach(key => {
            const amount = Number(entry[key]) || 0;
            if (amount > 0 && !processedKeys.has(key)) {
                totalExpense += amount;
            }
        });

        return { totalRevenue, totalExpense, netProfit: totalRevenue - totalExpense, baseUnitPrice };
    };

    // 🌟 데이터 세팅 (검색어 조립)
    const searchableEntries = useMemo(() => {
        return entries.map(entry => {
            const stats = calculateEntryStats(entry, itemLabels);
            let searchKeywords = [];

            // 동의어 세팅
            Object.keys(entry).forEach(key => {
                if (itemLabels[key] && entry[key] > 0) {
                    let label = itemLabels[key];
                    if (label.includes('유류')) label += ' 기름 기름값 기름갑 주유 주유비';
                    if (label.includes('식대')) label += ' 밥값 식사 점심 저녁 간식 커피 음료';
                    if (label.includes('통행')) label += ' 톨비 하이패스 톨게이트';
                    if (label.includes('수리') || label.includes('정비')) label += ' 고친거 부품 엔진오일 타이어';
                    if (label.includes('유지')) label += ' 요소수 세차 워셔액';
                    searchKeywords.push(label);
                }
            });

            if (entry.customItems) {
                entry.customItems.forEach(item => {
                    if (item.name) searchKeywords.push(item.name);
                });
            }

            const [y, m, d] = entry.date.split('-');
            const month = parseInt(m, 10);
            const day = parseInt(d, 10);
            
            return {
                ...entry,
                _stats: stats,
                searchString: `${month}월 ${day}일 ${month}월${day}일 ${m}월${d}일 ${entry.date} ${entry.memo || ''} ${entry.round || 0}회전 ${stats.baseUnitPrice} ${stats.netProfit} ${Math.abs(stats.netProfit)} ${searchKeywords.join(' ')}`
            };
        });
    }, [entries, itemLabels]);

    const fuseEntries = useMemo(() => new Fuse(searchableEntries, {
        keys: ['searchString'],
        threshold: 0.3, 
        ignoreLocation: true,
    }), [searchableEntries]);

    const highlightText = (text, target) => {
        if (!target.trim() || !text) return text;
        const parts = text.toString().split(new RegExp(`(${target})`, 'gi'));
        return parts.map((part, i) => 
            part.toLowerCase() === target.toLowerCase() 
                ? <mark key={i} className="bg-yellow-300 text-black rounded-sm px-0.5">{part}</mark> 
                : part
        );
    };

    // 🌟 검색 실행 및 그룹화
    const groupedResults = useMemo(() => {
        let filtered = [];

        if (showOnlyMemos) {
            filtered = searchableEntries.filter(e => !!e.memo);
        } else if (!query.trim()) {
            return {};
        } else {
            const dateMatch = query.match(/(\d+)\s*[월/.-]\s*(\d+)(?:\s*일)?/);
            const dayMatch = query.match(/(\d+)\s*일/);
            
            let textQuery = query;
            if (dateMatch) textQuery = textQuery.replace(dateMatch[0], '').trim();
            else if (dayMatch) textQuery = textQuery.replace(dayMatch[0], '').trim();

            let baseEntries = searchableEntries;
            if (textQuery) baseEntries = fuseEntries.search(textQuery).map(res => res.item);

            if (dateMatch) {
                const targetMonth = parseInt(dateMatch[1], 10);
                const targetDay = parseInt(dateMatch[2], 10);
                filtered = baseEntries.filter(entry => {
                    const [y, m, d] = entry.date.split('-');
                    return parseInt(m, 10) === targetMonth && parseInt(d, 10) === targetDay;
                });
            } else if (dayMatch && !query.includes('월')) {
                const targetDay = parseInt(dayMatch[1], 10);
                filtered = baseEntries.filter(entry => {
                    const [y, m, d] = entry.date.split('-');
                    return parseInt(d, 10) === targetDay;
                });
            } else {
                filtered = fuseEntries.search(query).map(res => res.item);
            }
        }

        const groups = {};
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(entry => {
            const [y, m] = entry.date.split('-');
            const monthKey = `${y}년 ${parseInt(m)}월`;
            if (!groups[monthKey]) groups[monthKey] = [];
            groups[monthKey].push(entry);
        });

        return groups;
    }, [query, showOnlyMemos, fuseEntries, searchableEntries]);


    // ✨ 뱃지(항목)를 중복 없이 깔끔하게 그려주는 함수
    const renderBadges = (entry) => {
        const badges = [];
        const addedKeys = new Set(); // 여기에 그려진 항목은 두 번 다시 안 그림!

        // 1. 커스텀 추가 항목 렌더링
        if (entry.customItems && Array.isArray(entry.customItems)) {
            entry.customItems.forEach(item => {
                if (item.key) addedKeys.add(item.key);
                
                const amount = Number(item.amount) || 0;
                const count = Number(item.count) || 1;
                const isExpense = item.type === 'expense';
                
                const finalAmount = isExpense 
                    ? amount 
                    : (item.unitPrice !== undefined ? (count * Number(item.unitPrice)) : amount);

               const label = item.name || item.key || itemLabels[item.key] || '항목';
                
               // ✨ 뱃지 안에 들어갈 내용을 상황에 맞게 똑똑하게 조립합니다.
                let badgeContent = '';
                if (isExpense) {
                    badgeContent = `${finalAmount.toLocaleString()}원`;
                } else if (item.unitPrice !== undefined) {
                    // ✨ 수량이 1개든 여러 개든 상관없이, 단가가 있으면 무조건 똑같은 양식으로 통일합니다!
                    badgeContent = `${count}건 × ${Number(item.unitPrice).toLocaleString()}원 (${finalAmount.toLocaleString()}원)`;
                } else {
                    // 단가가 아예 입력되지 않은 예전 데이터 항목들
                    badgeContent = `${count}건 (${finalAmount.toLocaleString()}원)`;
                }

                badges.push(
                    <span key={item.id || item.key} className={`text-[11px] font-bold p-1.5 px-2.5 rounded-lg ${isDarkMode ? 'bg-gray-900 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                        <span className="mr-1">{highlightText(label, query)}</span>
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                            {highlightText(badgeContent, query)}
                        </span>
                    </span>
                );
            });
        }

        // 2. 기본 수익 항목들 (커스텀에 없는 옛날 데이터용)
        const baseIncomeKeys = ['deliveryCount', 'returnCount', 'deliveryInterruptionAmount', 'freshBagCount'];
        baseIncomeKeys.forEach(key => {
            if (entry[key] > 0 && !addedKeys.has(key)) {
                const count = entry[key];
                const total = count * (entry._stats.baseUnitPrice || 0);
                const label = itemLabels[key] || key;
                badges.push(
                    <span key={key} className={`text-[11px] font-bold p-1.5 px-2.5 rounded-lg ${isDarkMode ? 'bg-gray-900 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                        {highlightText(label, query)}{' '}
                        {highlightText(`${count}건 (${total.toLocaleString()}원)`, query)}
                    </span>
                );
                addedKeys.add(key);
            }
        });

        // 3. 레거시 지출 항목들 (커스텀에 없는 옛날 데이터용)
        const legacyExpenseKeys = ['penaltyAmount', 'industrialAccidentCost', 'fuelCost', 'maintenanceCost', 'vatAmount', 'incomeTaxAmount', 'taxAccountantFee'];
        legacyExpenseKeys.forEach(key => {
            if (entry[key] > 0 && !addedKeys.has(key)) {
                const label = itemLabels[key] || key;
                badges.push(
                    <span key={key} className={`text-[11px] font-bold p-1.5 px-2.5 rounded-lg ${isDarkMode ? 'bg-gray-900 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                        {highlightText(label, query)}{' '}
                        {highlightText(entry[key].toLocaleString() + '원', query)}
                    </span>
                );
                addedKeys.add(key);
            }
        });

        return badges;
    };

    return (
        <div className="flex flex-col w-full max-w-lg mx-auto p-4 pb-20 pt-12">
            
            <div className="flex justify-between items-end mb-2 px-1">
                <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>검색</h2>
                <button 
                    onClick={() => setShowOnlyMemos(!showOnlyMemos)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                        showOnlyMemos 
                        ? 'bg-yellow-400 text-black shadow-md scale-105' 
                        : (isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-white text-gray-400 border border-gray-200')
                    }`}
                >
                    <Sparkles size={12} />
                    메모만 보기
                </button>
            </div>
            
            <div className={`relative flex items-center rounded-2xl border-2 mb-6 transition-all shadow-sm 
                ${isDarkMode ? 'bg-gray-800 border-yellow-700/50 focus-within:border-yellow-500' : 'bg-white border-yellow-200 focus-within:border-yellow-400'}`}>
                
                <Search className="ml-4 text-yellow-600/40" size={20} />
                <input
                    type="text"
                    placeholder={showOnlyMemos ? "메모 검색 모드 활성화" : "날짜, 메모내용, 단가 등 검색"}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className={`w-full p-4 bg-transparent focus:outline-none font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                />
                {inputText && !showOnlyMemos && (
                    <button onClick={() => setInputText('')} className="mr-4">
                        <X size={20} className="text-gray-400" />
                    </button>
                )}
            </div>

            <div className="space-y-6">
                {Object.keys(groupedResults).length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <Lightbulb size={48} className="mx-auto mb-2 opacity-10" />
                        <p>{showOnlyMemos ? "작성된 메모가 없습니다." : "찾으시는 내용을 입력해주세요."}</p>
                    </div>
                ) : (
                    Object.keys(groupedResults).sort((a, b) => b.localeCompare(a)).map(month => (
                        <div key={month} className="space-y-3">
                            <div className="flex items-center gap-2 px-2">
                                <span className="text-sm font-black text-gray-400">{month}</span>
                                <div className="h-[1px] flex-1 bg-gray-200 dark:bg-gray-700"></div>
                            </div>

                            {groupedResults[month].map(entry => {
                                const [y, m, d] = entry.date.split('-');
                                const formattedDate = `${parseInt(m)}월 ${parseInt(d)}일`;
                                const isPositive = entry._stats.netProfit >= 0;

                                return (
                                    <div key={entry.id} onClick={() => onEdit(entry)} className={`p-5 rounded-2xl border-2 cursor-pointer active:scale-[0.98] transition-all ${isDarkMode ? 'bg-gray-800 border-gray-700 hover:border-yellow-500/50' : 'bg-white border-gray-100 hover:border-yellow-400 shadow-sm'}`}>
                                        
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`text-base font-black ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                                                {highlightText(formattedDate, query)} <span className="text-xs opacity-50 font-medium ml-0.5">({highlightText((entry.round || 0) + '회전', query)})</span>
                                            </span>
                                            
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className={`text-lg font-black ${isPositive ? 'text-red-500' : 'text-blue-500'}`}>
                                                    {isPositive ? '+' : ''}{highlightText(entry._stats.netProfit.toLocaleString(), query)}원
                                                </span>
                                                {/* ✨ 기본 단가가 0원일 때는 쓸데없는 정보를 띄우지 않고 숨깁니다! */}
                                                {entry._stats.baseUnitPrice > 0 && (
                                                    <span className="text-[10px] font-bold text-gray-400">
                                                        기본 단가: {highlightText(entry._stats.baseUnitPrice.toLocaleString(), query)}원
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {entry.memo && (
                                            <div className={`mb-3 p-3 rounded-xl border-l-4 border-yellow-400 ${isDarkMode ? 'bg-gray-700/50 text-gray-200' : 'bg-yellow-50 text-gray-800'}`}>
                                                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                                                    {highlightText(entry.memo, query)}
                                                </p>
                                            </div>
                                        )}

                                        {/* ✨ 중복 없이 완벽하게 정리된 뱃지들 렌더링! */}
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {renderBadges(entry)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
            {showScrollTop && (
                <button
                    onClick={scrollToTop}
                    className={`fixed z-50 bottom-24 right-5 p-3 rounded-full shadow-lg transition-transform active:scale-90 ${
                        isDarkMode ? 'bg-gray-800 border-2 border-yellow-600 text-yellow-400' : 'bg-white border-2 border-yellow-400 text-yellow-600'
                    }`}
                >
                    <ArrowUp size={24} strokeWidth={3} />
                </button>
            )}

        </div> // 👈 이게 기존 SearchView의 가장 마지막 닫는 </div> 입니다.
    );
};
    
export default SearchView;