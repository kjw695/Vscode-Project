import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ArrowLeft, MapPin } from 'lucide-react';
import { REGIONS, REGION_DETAILS } from '../../data/campData';

function RegionCampModal({ isOpen, onClose, onSelect, isDarkMode, currentRegion }) {
    // 단계 관리: 'region' (시/도) -> 'district' (세부 시/군) -> 'camp' (캠프)
    const [step, setStep] = useState('region');
    const [selectedRegionName, setSelectedRegionName] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [detailData, setDetailData] = useState(null);

    // 모달이 열릴 때마다 항상 처음(시/도 선택 단계)으로 리셋
    useEffect(() => {
        if (isOpen) {
            setStep('region');
            setSelectedRegionName('');
            setSelectedDistrict('');
            setDetailData(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // 1단계: 시/도 클릭 시
    const handleRegionClick = (region) => {
        setSelectedRegionName(region.name);
        const details = REGION_DETAILS[region.id];

        if (details && details.districts && details.districts.length > 0) {
            setDetailData(details);
            setStep('district'); // 세부 시/군 선택 단계로 이동
        } else {
            // 하위 정보가 없으면 시/도까지만 선택
            onSelect(region.name);
            onClose();
        }
    };

    // 2단계: 세부 시/군 클릭 시
    const handleDistrictClick = (districtName) => {
        setSelectedDistrict(districtName);
        setStep('camp'); // 최종 캠프 선택 단계로 이동
    };

    // 3단계: 최종 캠프 선택 시 (객체에서 name만 뽑아서 조합)
    const handleCampSelect = (campObj) => {
        const finalValue = `${selectedRegionName} ${selectedDistrict} - ${campObj.name}`;
        onSelect(finalValue);
        onClose();
    };

    // 뒤로 가기 핸들러
    const handleBack = () => {
        if (step === 'camp') {
            setStep('district');
        } else if (step === 'district') {
            setStep('region');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
            <div className={`w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
                
                {/* 모달 헤더 */}
                <div className={`flex items-center justify-between px-5 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-2">
                        {step !== 'region' && (
                            <button 
                                onClick={handleBack} 
                                className={`p-1.5 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <h3 className="text-lg font-bold">
                            {step === 'region' && '지역(시/도) 선택'}
                            {step === 'district' && `${selectedRegionName} 지역 선택`}
                            {step === 'camp' && `${selectedDistrict} 캠프 선택`}
                        </h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        className={`p-1.5 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 모달 본문 */}
                <div className="p-5 overflow-y-auto flex-1">
                    {/* 1단계: 시/도 그리드 버튼 */}
                    {step === 'region' && (
                        <div>
                            <p className={`text-xs mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                활동하시는 지역의 큰 틀(시/도)을 선택해주세요.
                            </p>
                            <div className="grid grid-cols-3 gap-2.5">
                                {REGIONS.map((region) => (
                                    <button
                                        key={region.id}
                                        onClick={() => handleRegionClick(region)}
                                        className={`py-3.5 px-3 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center ${
                                            isDarkMode 
                                                ? 'bg-gray-700/50 border-gray-600 hover:bg-blue-900/30 hover:border-blue-500 hover:text-blue-400' 
                                                : 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600'
                                        }`}
                                    >
                                        {region.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2단계: 세부 시/군 목록 */}
                    {step === 'district' && detailData && (
                        <div className="space-y-2">
                            <p className={`text-xs mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                세부 지역(시/군/구)을 선택해주세요.
                            </p>
                            {detailData.districts.map((district, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleDistrictClick(district)}
                                    className={`w-full p-4 rounded-xl border text-left font-medium transition-all flex items-center justify-between ${
                                        isDarkMode 
                                            ? 'bg-gray-700/50 border-gray-600 hover:bg-blue-900/30 hover:border-blue-500 text-white' 
                                            : 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-500 text-gray-900'
                                    }`}
                                >
                                    <span>{district}</span>
                                    <ChevronRight size={18} className="text-gray-400" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 3단계: 최종 쿠팡 캠프 목록 (이름 + 주소 표시) */}
                    {step === 'camp' && detailData && (
                        <div className="space-y-2">
                            <p className={`text-xs mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                해당 지역의 쿠팡 캠프를 선택해주세요.
                            </p>
                            {detailData.camps[selectedDistrict] && detailData.camps[selectedDistrict].length > 0 ? (
                                detailData.camps[selectedDistrict].map((campObj, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleCampSelect(campObj)}
                                        className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                                            isDarkMode 
                                                ? 'bg-gray-700/50 border-gray-600 hover:bg-blue-900/30 hover:border-blue-500 text-white' 
                                                : 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-500 text-gray-900'
                                        }`}
                                    >
                                        <div className="flex flex-col">
                                            {/* 캠프 이름 */}
                                            <span className="font-bold text-sm">{campObj.name}</span>
                                            {/* 주소 (하단 연한 글씨) */}
                                            <span className={`text-xs mt-0.5 flex items-center gap-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                <MapPin size={12} />
                                                {campObj.address}
                                            </span>
                                        </div>
                                        <ChevronRight size={18} className="text-gray-400 flex-shrink-0 ml-2" />
                                    </button>
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    등록된 캠프가 없습니다.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 하단 닫기/초기화 영역 (Container Query 적용) */}
               {/* 하단 닫기/초기화 영역 */}
                <div className={`p-4 border-t flex justify-between items-center gap-3 ${isDarkMode ? 'border-gray-700 bg-gray-800/80' : 'border-gray-100 bg-gray-50'}`}>
                    <button
                        onClick={() => {
                            onSelect('');
                            onClose();
                        }}
                        className={`flex-shrink-0 text-xs px-3.5 py-2 rounded-lg font-bold transition-colors ${
                            isDarkMode 
                                ? 'text-yellow-400 bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-800/50' 
                                : 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200'
                        }`}
                    >
                        초기화
                    </button>
                    
                    {/* 글자 크기를 정상적으로 유지하며, 길어지면 가로 스크롤로 확인 가능 */}
                    <div className="flex-1 overflow-x-auto text-right">
                        <span className={`whitespace-nowrap text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            현재 선택: {currentRegion || '미선택'}
                        </span>
                    </div>
                </div>
                   
            </div>
        </div>
    );
}

export default RegionCampModal;