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
      gender: '남성',
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
              gender: profile.gender || '남성',
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
      if (!user) return;
      setIsSaving(true);
      try {
          const { error } = await supabase
              .from('profiles')
              .update(formData)
              .eq('id', user.id);

          if (error) throw error;
          
          alert('내 정보가 안전하게 저장되었습니다.');
          setIsEditing(false);

          setIsEditing(false);
      } catch (error) {
          alert('저장에 실패했습니다: ' + error.message);
      } finally {
          setIsSaving(false);
      }
  };

  if (showLogin) {
    return <LoginPage onBack={() => setShowLogin(false)} isDarkMode={isDarkMode} />;
  }

  const handleLogoutClick = async () => {
      if(window.confirm("로그아웃 하시겠습니까?\n기기에 임시 저장된 남은 데이터가 지워지고 빈 오프라인 장부로 전환됩니다.")) {
          await signOut();
          window.location.reload(); 
      }
  };

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
  return (
    <div className={`w-full max-w-4xl mx-auto px-2 sm:px-4 ${isEditing ? 'pb-80' : 'pb-10'}`}>
      <div className="flex items-center mb-5 pt-2">
        <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold ml-1">계정 관리</h2>
      </div>

      {isLoggedIn ? (
        <>
          <div className={`${cardClass}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className={`flex-shrink-0 p-2.5 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
                  <Cloud size={26} className="text-blue-500" />
                </div>
                
                <div className="flex flex-col justify-center flex-1 min-w-0 py-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-lg font-bold leading-none truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {maskName(formData.full_name) || '사용자'} 님
                    </h3>
                    
                    <button onClick={handleLogoutClick} className={`flex-shrink-0 px-2 py-1 rounded-md flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 ${isDarkMode ? 'bg-red-950/40 hover:bg-red-900/50' : 'bg-red-50 hover:bg-red-100'}`}>
                      <LogOut size={14} />
                      <span>로그아웃</span>
                    </button>
                  </div>

                  <p className={`mt-1.5 text-sm truncate leading-none ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {user?.email}
                  </p>
                </div>
              </div>
            </div>

            <div className={`mt-2 p-2.5 rounded-lg text-sm text-center ${isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                현재 데이터가 서버에 안전하게 실시간으로 동기화되고 있습니다.
            </div>
          </div>

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
                        <span className="font-medium">{formData.birth_date || '-'} ({formData.gender || '미설정'})</span></div>
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
        </>
      ) : (
        <div className={`${cardClass} items-center justify-center text-center p-8`}>
            <div className={`p-4 rounded-full mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <UserX size={48} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
            </div>
            
            <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                로컬 모드로 실행 중
            </h3>

            <p className={`mb-6 max-w-md ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                현재 별도의 계정 로그인 없이 기기 내부에 데이터를 저장하고 있습니다. 
                서버에 데이터가 전송되지 않으므로 개인정보 유출 걱정 없이 안전하게 사용할 수 있습니다.
            </p>

            <div className={`flex items-start text-left p-4 rounded-md w-full max-w-md mb-6 ${isDarkMode ? 'bg-blue-900/30 text-blue-100' : 'bg-blue-50 text-blue-800'}`}>
                <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-bold mb-1">데이터 관리 주의사항</p>
                    <p>
                        앱을 삭제하거나 브라우저 캐시를 정리하면 데이터가 유실될 수 있습니다. 
                        <strong> [더보기 &gt; 데이터]</strong> 메뉴에서 구글 드라이브 백업을 주기적으로 이용해주세요.
                    </p>
                </div>
            </div>

            <button
                onClick={() => setShowLogin(true)}
                className="w-full max-w-md py-3 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
                로그인하고 다른 기기와 동기화하기
            </button>
       </div>
      )}

      {/* 지역/캠프 선택 모달 컴포넌트 연결 */}
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