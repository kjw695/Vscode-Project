import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, UserX, AlertCircle, Cloud, LogOut, Eye, EyeOff } from 'lucide-react';
import LoginPage from '../auth/LoginPage';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient'; 
import RegionCampModal from '../common/RegionCampModal';

const maskName = (name) => {
    if (!name) return '-';
    if (name.length <= 2) return name.charAt(0) + '*';
    return name.charAt(0) + '*'.repeat(name.length - 2) + name.slice(-1);
};

const maskPhone = (phone) => {
    if (!phone) return '-';
    const cleanNumber = phone.replace(/[^0-9]/g, '');
    if (cleanNumber.length === 11) return cleanNumber.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3');
    if (cleanNumber.length === 10) return cleanNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-***-$3');
    return phone;
};

const maskVehicle = (vehicle) => {
    if (!vehicle || vehicle.length < 4) return '-';
    return vehicle.slice(0, -4) + '****'; 
};

function AccountView({ onBack, isDarkMode }) {
  const [showLogin, setShowLogin] = useState(false);
  const { isLoggedIn, user, profile, signOut } = useAuth(); 

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnmasked, setShowUnmasked] = useState(false);

  const headerRef = useRef(null);

  const [formData, setFormData] = useState({
      full_name: '',
      phone_number: '',
      birth_date: '',
      gender: '',
      region: '',
      vehicle_number: ''
  });
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);

  useEffect(() => {
      if (profile) {
          setFormData({
              full_name: profile.full_name || '',
              phone_number: profile.phone_number || '',
              birth_date: profile.birth_date || '',
              gender: profile.gender || '',
              region: profile.region || '',
              vehicle_number: profile.vehicle_number || ''
          });
      }
  }, [profile]);

  const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e, part) => {
      let val = e.target.value.replace(/[^0-9]/g, ''); 
      const parts = (formData.birth_date || '').split('-');
      let y = parts[0] || '', m = parts[1] || '', d = parts[2] || '';

      if (part === 'year') {
          y = val.slice(0, 4);
          if (val.length === 4) document.getElementById('bMonth').focus(); 
      } else if (part === 'month') {
          m = val.slice(0, 2);
          if (val.length === 2) document.getElementById('bDay').focus();   
      } else if (part === 'day') {
          d = val.slice(0, 2);
      }

      let newDate = `${y}-${m}-${d}`;
      if (!y && !m && !d) newDate = ''; 
      setFormData(prev => ({ ...prev, birth_date: newDate }));
  };

  const handlePhoneChange = (e, part) => {
      let val = e.target.value.replace(/[^0-9]/g, ''); 
      const parts = (formData.phone_number || '').split('-');
      let p1 = parts[0] || '', p2 = parts[1] || '', p3 = parts[2] || '';

      if (part === 'p1') {
          p1 = val.slice(0, 3);
          if (val.length === 3) document.getElementById('p2').focus(); 
      } else if (part === 'p2') {
          p2 = val.slice(0, 4);
          if (val.length === 4) document.getElementById('p3').focus();   
      } else if (part === 'p3') {
          p3 = val.slice(0, 4);
      }

      let newPhone = `${p1}-${p2}-${p3}`;
      if (!p1 && !p2 && !p3) newPhone = ''; 
      setFormData(prev => ({ ...prev, phone_number: newPhone }));
  };

const handleEditClick = () => {
      // ✨ 수정 2: 로그인 안 되어 있으면 팝업만 띄우고 그 자리에 머물기
      if (!isLoggedIn || !user) {
          alert("내 정보를 수정하려면 먼저 로그인을 해주세요.");
          // setShowLogin(true); 👈 이 줄을 삭제했습니다!
          return;
      }

      setIsEditing(true);
      setTimeout(() => {
          if (headerRef.current) {
              const y = headerRef.current.getBoundingClientRect().top + window.scrollY;
              window.scrollTo({ top: y, behavior: 'smooth' });
          }
      }, 100);
  };

  const handleFocus = (e) => {
      setTimeout(() => {
          const targetTop = e.target.getBoundingClientRect().top;
          const offset = targetTop - (window.innerHeight * 0.3); 
          
          const scrollWrapper = e.target.closest('.overflow-y-auto');
          if (scrollWrapper) {
              scrollWrapper.scrollBy({ top: offset, behavior: 'smooth' });
          } else {
              window.scrollBy({ top: offset, behavior: 'smooth' });
          }
      }, 300);
  };

  const handleSave = async () => {
      // ✨ 오프라인 상태에서 저장하려고 하면 막고 로그인 창 띄우기
      if (!isLoggedIn || !user) {
          alert("내 정보를 안전하게 저장하려면 먼저 로그인을 해주세요.");
          setShowLogin(true);
          return;
      }

      setIsSaving(true);
      try {
          const { error } = await supabase
              .from('profiles')
              .update(formData)
              .eq('id', user.id);

          if (error) throw error;
          
          alert('내 정보가 안전하게 저장되었습니다.');
          setIsEditing(false);
      } catch (error) {
          alert('저장에 실패했습니다: ' + error.message);
      } finally {
          setIsSaving(false);
      }
  };

  const handleLogoutClick = async () => {
      if(window.confirm("로그아웃 하시겠습니까?\n기기에 임시 저장된 남은 데이터가 지워지고 빈 오프라인 장부로 전환됩니다.")) {
          await signOut();
          window.location.reload(); 
      }
  };

  if (showLogin) {
    return <LoginPage onBack={() => setShowLogin(false)} isDarkMode={isDarkMode} />;
  }

  const cardClass = `flex flex-col p-3 rounded-xl shadow-sm mb-2 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`;
  const inputClass = `w-full p-3 mt-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`;

  const birthParts = (formData.birth_date || '').split('-');
  const bYear = birthParts[0] || '';
  const bMonth = birthParts[1] || '';
  const bDay = birthParts[2] || '';

  const phoneParts = (formData.phone_number || '').split('-');
  const p1 = phoneParts[0] || '';
  const p2 = phoneParts[1] || '';
  const p3 = phoneParts[2] || '';

  // ✨ 현재 로그인한 계정 종류 확인
  const currentProvider = user?.app_metadata?.provider || '';

  // ✨ SNS 연동 박스를 그려주는 전용 함수
 // ✨ 연동 시 칙칙한 회색을 없애고 가장 화사하게 빛나도록 디자인 변경!
  const renderSnsBox = (name, id, logoSvg, unlinkedBg, unlinkedText) => {
      const isLinked = isLoggedIn && currentProvider === id;
      
      return (
          <div 
              key={id} 
              onClick={() => {
                  if (!isLoggedIn) {
                      // 비로그인 상태일 때는 경고창 없이 바로 로그인 화면으로(기존 유지)
                  } else if (!isLinked) {
                      alert('현재 로그인된 계정이 아닙니다.');
                  }
              }}
              className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border transition-all duration-300 cursor-pointer ${
              isLinked 
                  // 🟢 연동 시: 화사한 흰색 배경 + 선명한 파란색 테두리 + 그림자 효과로 입체감 부여
                  ? (isDarkMode ? 'bg-gray-800 border-blue-500 shadow-md' : 'bg-white border-blue-400 ring-1 ring-blue-400 shadow-md') 
                  // ⚪️ 미연동 시: 오히려 살짝 어두운 배경으로 묻히게 처리
                  : (isDarkMode ? 'bg-gray-900 border-gray-800 opacity-60' : 'bg-gray-50 border-gray-200 opacity-70 hover:bg-gray-100')
          }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xl font-black mb-1.5 shadow-sm ${
                  isLinked 
                      // 🟢 연동 시: 로고를 회색으로 죽이지 않고, 구글/카카오 고유의 화사한 색상 100% 보여주기!
                      ? `${unlinkedBg} ${unlinkedText} border${isDarkMode ? 'border-gray-600' : 'border-gray-100'}` 
                      // ⚪️ 미연동 시: 브랜드 색상은 유지하되 약간 흐릿한 느낌
                      : `${unlinkedBg} ${unlinkedText} border${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`
              }`}>
                  {logoSvg}
              </div>
              <span className={`text-[11px] font-bold ${
                  isLinked 
                      // 🟢 글자색도 파란색으로 활기차게!
                      ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') 
                      : (isDarkMode ? 'text-gray-500' : 'text-gray-400')
              }`}>
                  {name}
              </span>
          </div>
      );
  };

  return (
    <div className={`w-full max-w-4xl mx-auto px-2 sm:px-4 ${isEditing ? 'pb-80' : 'pb-10'}`}>
      <div className="flex items-center mb-5 pt-2">
        <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold ml-1">계정 관리</h2>
      </div>

      {/* 🟢 1. 상단 계정 정보 및 연동 영역 (통합됨) */}
      <div className={`${cardClass}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className={`flex-shrink-0 p-2.5 rounded-full ${isDarkMode ? 'bg-gray-700' : (isLoggedIn ? 'bg-blue-50' : 'bg-gray-100')}`}>
              {isLoggedIn ? <Cloud size={26} className="text-blue-500" /> : <UserX size={26} className="text-gray-400" />}
            </div>
            
            <div className="flex flex-col justify-center flex-1 min-w-0 py-0.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className={`text-lg font-bold leading-none truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {isLoggedIn ? (maskName(formData.full_name) || '사용자') : '로컬 사용자'} 님
                </h3>
                
                {isLoggedIn ? (
                    <button onClick={handleLogoutClick} className={`flex-shrink-0 px-2 py-1 rounded-md flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 ${isDarkMode ? 'bg-red-950/40 hover:bg-red-900/50' : 'bg-red-50 hover:bg-red-100'}`}>
                        <LogOut size={14} />
                        <span>로그아웃</span>
                    </button>
                ) : (
                    <button onClick={() => setShowLogin(true)} className={`flex-shrink-0 px-3 py-1.5 rounded-md flex items-center gap-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors`}>
                        로그인
                    </button>
                )}
              </div>

              <p className={`mt-1.5 text-sm truncate leading-none ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {isLoggedIn ? user?.email : '기기 내부에만 임시 저장 중'}
              </p>
            </div>
          </div>
        </div>

     {/* ✨ 줄바꿈 안됨(whitespace-nowrap), '...' 절대 안생김! 글자 크기도 시원하게 유지 */}
        <div className={`mt-3 py-3 w-full flex justify-center items-center rounded-lg ${
            isLoggedIn 
            ? (isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700')
            : (isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')
        }`}>
            {/* 글자 크기를 최소 12px(text-xs) ~ 13px로 유지하여 가독성 확보 */}
            <span className="text-xs sm:text-[13px] md:text-sm font-medium whitespace-nowrap tracking-tight px-1 sm:px-2">
                {isLoggedIn 
                    ? '현재 데이터가 클라우드에 실시간 동기화되고 있습니다.'
                    : '로그인하시면 다른 기기와 데이터를 안전하게 동기화할 수 있습니다.'}
            </span>
        </div>

       {/* 계정 연동 상태 영역 */}
        <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <h4 className={`text-xs font-bold mb-3 px-1 flex items-center justify-between ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <span>계정 연동 상태</span>
                {/* ✨ 수정 4: 연동 상태 텍스트를 헤더 영역으로 이동 */}
                {!isLoggedIn ? (
                    <span className="text-[10px] text-blue-500 animate-pulse">아이콘을 눌러 연동하기</span>
                ) : (
                    <span className="text-[11px] text-green-600 dark:text-green-400 font-black bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-md">
                        ✓ {currentProvider === 'google' ? 'Google' : currentProvider === 'apple' ? 'Apple' : currentProvider === 'kakao' ? 'Kakao' : ''} 연동 중
                    </span>
                )}
            </h4>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {renderSnsBox('Google', 'google', 
                    <svg viewBox="0 0 48 48" className="w-4 h-4">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>, 
                'bg-white', 'text-gray-800')}
                
                {renderSnsBox('Apple', 'apple', 
                    <svg viewBox="0 0 384 512" fill="currentColor" className="w-4 h-4 mb-0.5">
                        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                    </svg>, 
                'bg-black', 'text-white')}
                
                {renderSnsBox('Kakao', 'kakao', 
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mb-0.5">
                        <path d="M12 3c-5.5 0-10 3.5-10 8 0 2.8 1.8 5.3 4.5 6.7-.4 1.5-1.4 5.3-1.5 5.6-.1.5.4.6.7.4 1-.6 6-4.1 8-5.5.4 0 .9.1 1.3.1 5.5 0 10-3.5 10-8s-4.5-8-10-8z"/>
                    </svg>, 
                'bg-[#FEE500]', 'text-black')}
            </div>
        </div>
      </div>

      {/* 🟢 2. 내 정보 수정 영역 (통합됨) */}
      <div className={`${cardClass}`}>
        <div ref={headerRef} className={`flex justify-between items-center border-b pb-3 mb-1 sticky top-0 z-10 -mx-3 px-3 pt-3 -mt-3 rounded-t-xl ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">내 정보 🔒</h3>
                {!isEditing && (
                    <button onClick={() => setShowUnmasked(!showUnmasked)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                        {showUnmasked ? <EyeOff size={18} className="text-gray-500" /> : <Eye size={18} className="text-gray-500" />}
                    </button>
                )}
            </div>
            {!isEditing ? (
                <button onClick={handleEditClick} className="text-blue-500 font-bold text-sm bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg active:scale-95">
                    수정하기
                </button>
            ) : (
                <button onClick={handleSave} disabled={isSaving} className="text-white font-bold text-sm bg-blue-600 px-4 py-1.5 rounded-lg active:scale-95 disabled:opacity-50">
                    {isSaving ? '저장 중...' : '저장 완료'}
                </button>
            )}
        </div>

        <p className="text-xs text-gray-500 mb-4 px-1">
            * 입력하신 개인정보는 인사 관리와 배송 업무를 위해 소속 팀의 관리자에게만 제한적으로 제공됩니다.
        </p>

        {!isEditing && (
            <div className="space-y-4 text-sm px-1">
                <div className="flex"><span className="w-24 text-gray-500">이름</span> 
                    <span className="font-medium">{showUnmasked ? (formData.full_name || '-') : maskName(formData.full_name)}</span></div>
                <div className="flex"><span className="w-24 text-gray-500">연락처</span> 
                    <span className="font-medium">{showUnmasked ? (formData.phone_number || '-') : maskPhone(formData.phone_number)}</span></div>
               <div className="flex"><span className="w-24 text-gray-500">생년월일</span> 
                    <span className="font-medium">{formData.birth_date || '-'}</span></div>
                <div className="flex"><span className="w-24 text-gray-500">지역</span> 
                    <span className="font-medium">{formData.region || '-'}</span></div>
                <div className="flex"><span className="w-24 text-gray-500">차량번호</span> 
                    <span className="font-medium">{showUnmasked ? (formData.vehicle_number || '-') : maskVehicle(formData.vehicle_number)}</span></div>
            </div>
        )}

        {isEditing && (
            <div className="space-y-4 px-1 pb-2">
                <div>
                    <label className="text-sm text-gray-500">이름</label>
                    <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} onFocus={handleFocus} className={inputClass} placeholder="예: 홍길동" />
                </div>
                <div>
                    <label className="text-sm text-gray-500">연락처</label>
                    <div className={`flex items-center justify-between w-full mt-1 border rounded-lg focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}>
                        <input 
                            id="p1" type="tel" value={p1} onChange={(e) => handlePhoneChange(e, 'p1')} onFocus={handleFocus}
                            placeholder="010" maxLength={3} className="flex-1 py-3 bg-transparent text-center focus:outline-none min-w-0"
                        />
                        <span className="text-gray-400 font-bold flex-shrink-0 px-1">-</span>
                        <input 
                            id="p2" type="tel" value={p2} onChange={(e) => handlePhoneChange(e, 'p2')} onFocus={handleFocus}
                            placeholder="1234" maxLength={4} className="flex-1 py-3 bg-transparent text-center focus:outline-none min-w-0"
                        />
                        <span className="text-gray-400 font-bold flex-shrink-0 px-1">-</span>
                        <input 
                            id="p3" type="tel" value={p3} onChange={(e) => handlePhoneChange(e, 'p3')} onFocus={handleFocus}
                            placeholder="5678" maxLength={4} className="flex-1 py-3 bg-transparent text-center focus:outline-none min-w-0"
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    <div className="flex-1">
                        <label className="text-sm text-gray-500">생년월일</label>
                        <div className={`flex items-center justify-between w-full mt-1 border rounded-lg focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}>
                            <input 
                                id="bYear" type="tel" value={bYear} onChange={(e) => handleDateChange(e, 'year')} onFocus={handleFocus}
                                placeholder="YYYY" maxLength={4} className="flex-1 py-3 bg-transparent text-center focus:outline-none min-w-0"
                            />
                            <span className="text-gray-400 font-bold flex-shrink-0 px-1">-</span>
                            <input 
                                id="bMonth" type="tel" value={bMonth} onChange={(e) => handleDateChange(e, 'month')} onFocus={handleFocus}
                                placeholder="MM" maxLength={2} className="flex-1 py-3 bg-transparent text-center focus:outline-none min-w-0"
                            />
                            <span className="text-gray-400 font-bold flex-shrink-0 px-1">-</span>
                            <input 
                                id="bDay" type="tel" value={bDay} onChange={(e) => handleDateChange(e, 'day')} onFocus={handleFocus}
                                placeholder="DD" maxLength={2} className="flex-1 py-3 bg-transparent text-center focus:outline-none min-w-0"
                            />
                        </div>
                    </div>
                    <div className="w-full">
                        <label className="text-sm text-gray-500">성별</label>
                        <select name="gender" value={formData.gender} onChange={handleChange} onFocus={handleFocus} className={inputClass}>
                            <option value="남성">남성</option>
                            <option value="여성">여성</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="text-sm text-gray-500">활동 지역 및 캠프</label>
                    <button
                        type="button"
                        onClick={() => setIsRegionModalOpen(true)}
                        className={`w-full p-3 mt-1 border rounded-lg text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                        }`}
                    >
                        <span className={formData.region ? '' : 'text-gray-400'}>
                            {formData.region || '지역 및 캠프를 선택해주세요'}
                        </span>
                        <span className="text-xs bg-blue-500 text-white px-2.5 py-1 rounded-md font-medium">
                            변경
                        </span>
                    </button>
                </div>
                <div>
                    <label className="text-sm text-gray-500">차량번호</label>
                    <input type="text" name="vehicle_number" value={formData.vehicle_number} onChange={handleChange} onFocus={handleFocus} className={inputClass} placeholder="예: 서울82배8282" />
                </div>
            </div>
        )}
      </div>

      <RegionCampModal 
          isOpen={isRegionModalOpen}
          onClose={() => setIsRegionModalOpen(false)}
          isDarkMode={isDarkMode}
          currentRegion={formData.region}
          onSelect={(selectedRegion) => {
              setFormData(prev => ({ ...prev, region: selectedRegion }));
          }}
      />
    </div>
  );
}

export default AccountView;