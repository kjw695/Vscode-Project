import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardCheck, Printer, History, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { listDailyInspectionRecords, readDailyInspectionRecord, saveDailyInspectionRecord, readSavedDriverSignature, saveSavedDriverSignature, readSavedTransportCompanyName, saveSavedTransportCompanyName } from '../../services/dailyInspectionService';
import { printDailyInspectionMonth } from './dailyInspectionPrint';
import SignaturePad from './DailyInspectionSignaturePad';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

const INSPECTION_GROUPS = [
 { title:'외관점검', items:[
  {id:'cleanliness',label:'번호판, 전면유리, 후사경 등의 청결상태'},
  {id:'lighting',label:'후미등, 차폭등 등 등화장치 작동상태'},
  {id:'wipers',label:'창닦이기(와이퍼) 작동상태'},
  {id:'cargoBody',label:'적재함·덮개·보조지지대·측면 보호대·후부반사판·연결장치의 부착 및 훼손 여부'}
 ]},
 { title:'상태점검', items:[
  {id:'tires',label:'타이어 손상 및 마모(1.6mm 이상) 여부'},
  {id:'cargoFixing',label:'화물·적재함 덮개·결속장치 및 판스프링 고정상태'},
  {id:'wheelNuts',label:'바퀴 너트 등의 균열 여부'},
  {id:'brakes',label:'제동장치 작동 및 제동력 이상 여부',extra:true},
  {id:'engineLeak',label:'원동기 누유·냉각수·엔진오일 등 이상 여부',extra:true},
  {id:'illegalAttachments',label:'판스프링 등 불법 부착물·임의 개조 여부',extra:true}
 ]},
 { title:'기타', items:[
  {id:'fluidsAndWarning',label:'냉각수·공기압·엔진오일 등 차량 이상 여부(계기판 확인)'},
  {id:'seatBelt',label:'좌석 안전띠 상태'},
  {id:'fireExtinguisher',label:'소화기 비치 여부'},
  {id:'warningTriangle',label:'안전삼각대 등 비치 여부'}
 ]}
];
const ALL_ITEMS=INSPECTION_GROUPS.flatMap(group=>group.items);
const formatDateLabel=(dateKey)=>{
 if(!dateKey)return '';
 const [year,month,day]=dateKey.split('-').map(Number);
 const date=new Date(year,month-1,day);
 return `${year}년 ${month}월 ${day}일 (${['일','월','화','수','목','금','토'][date.getDay()]})`;
};
const formatTimestamp=(value)=>{
 if(!value)return '-';
 const d=new Date(value);
 if(Number.isNaN(d.getTime()))return '-';
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

const DailyInspectionView=({onBack,onSaved,date,userId,profile,isDarkMode,scheduleStatus='work'})=>{
 const [answers,setAnswers]=useState({});
 const [actionNotes,setActionNotes]=useState('');
 const [saveError,setSaveError]=useState('');
 const [isSaved,setIsSaved]=useState(false);
 const [transportCompanyName,setTransportCompanyName]=useState('');
 const [driverName,setDriverName]=useState(profile?.full_name||profile?.display_name||'');
 const [vehicleNumber,setVehicleNumber]=useState(profile?.vehicle_number||'');
 const [driverSignature,setDriverSignature]=useState('');
 const [savedDriverSignature,setSavedDriverSignature]=useState('');
 const [signatureMessage,setSignatureMessage]=useState('');
 const [correctionReason,setCorrectionReason]=useState('');
 const [currentRecord,setCurrentRecord]=useState(null);
 const [monthRecords,setMonthRecords]=useState([]);
 const [selectedMonth,setSelectedMonth]=useState(String(date||'').slice(0,7));
 const [isSavingProfile,setIsSavingProfile]=useState(false);
 const [profileSaveMessage,setProfileSaveMessage]=useState('');
 const [profileSaveError,setProfileSaveError]=useState('');
 const {user:authUser,refreshProfile}=useAuth();

 useEffect(()=>{
  setDriverName(profile?.full_name||profile?.display_name||'');
  setVehicleNumber(profile?.vehicle_number||'');
  setProfileSaveMessage('');setProfileSaveError('');
 },[profile?.full_name,profile?.display_name,profile?.vehicle_number]);

 const refreshRecords=()=>{
  const latest=readDailyInspectionRecord(userId,date);
  setCurrentRecord(latest);
  setAnswers(latest?.answers&&typeof latest.answers==='object'?latest.answers:{});
  setActionNotes(latest?.actionNotes||'');
  setTransportCompanyName(latest?.transportCompanyName||readSavedTransportCompanyName(userId)||'');
  const savedSignature=readSavedDriverSignature(userId);
  setSavedDriverSignature(savedSignature);
  setDriverSignature(latest?.driverSignature||savedSignature||'');
  setSignatureMessage('');
  setIsSaved(Boolean(latest?.completedAt||latest?.updatedAt));
  setCorrectionReason('');
  // 월별 기록 목록은 선택한 월을 기준으로 별도 갱신합니다.
 };
 useEffect(()=>{refreshRecords();setSaveError('');},[userId,date]);
 useEffect(()=>{setSelectedMonth(String(date||'').slice(0,7));},[date]);
 useEffect(()=>{
  if(!selectedMonth)return;
  const [year,month]=selectedMonth.split('-');
  setMonthRecords(listDailyInspectionRecords(userId,year,month));
 },[userId,selectedMonth]);

 const answeredCount=useMemo(()=>ALL_ITEMS.filter(item=>['good','bad'].includes(answers[item.id])).length,[answers]);
 const badItems=useMemo(()=>ALL_ITEMS.filter(item=>answers[item.id]==='bad'),[answers]);
 const allAnswered=answeredCount===ALL_ITEMS.length;
 const allGoodSelected=ALL_ITEMS.every(item=>answers[item.id]==='good');
 const profileName=profile?.full_name||profile?.display_name||'';
 const profileVehicleNumber=profile?.vehicle_number||'';
 const hasMissingIdentity=!profileName.trim()||!profileVehicleNumber.trim();
 const identityChanged=driverName.trim()!==profileName.trim()||vehicleNumber.trim()!==profileVehicleNumber.trim();
 const canSave=allAnswered&&(badItems.length===0||actionNotes.trim().length>0)&&Boolean(transportCompanyName.trim())&&Boolean(driverName.trim())&&Boolean(vehicleNumber.trim())&&Boolean(driverSignature)&&(!currentRecord||Boolean(correctionReason.trim()));

 const chooseAnswer=(id,value)=>{setAnswers(prev=>({...prev,[id]:value}));setIsSaved(false);setSaveError('');};
 const markAllAsGood=()=>{
  const allGood=Object.fromEntries(ALL_ITEMS.map(item=>[item.id,'good']));
  setAnswers(allGood);
  setIsSaved(false);
  setSaveError('');
 };
 const handleSaveSignature=()=>{
  if(!driverSignature){
   setSignatureMessage('먼저 서명란에 손가락으로 서명해주세요.');
   return;
  }
  try{
   saveSavedDriverSignature(userId,driverSignature);
   setSavedDriverSignature(driverSignature);
   setSignatureMessage('서명을 이 기기에 저장했습니다. 다음 점검부터 자동으로 불러옵니다.');
  }catch(error){
   setSignatureMessage(error.message||'서명을 저장하지 못했습니다.');
  }
 };
 const handleLoadSavedSignature=()=>{
  if(!savedDriverSignature){
   setSignatureMessage('저장된 서명이 없습니다. 먼저 서명한 뒤 저장해주세요.');
   return;
  }
  setDriverSignature(savedDriverSignature);
  setIsSaved(false);
  setSignatureMessage('저장된 서명을 불러왔습니다.');
 };
 const handleSaveIdentity=async()=>{
  if(!authUser?.id){setProfileSaveError('내정보에 저장하려면 먼저 로그인해주세요.');return;}
  const name=driverName.trim(),vehicle=vehicleNumber.trim();
  if(!name||!vehicle){setProfileSaveError('이름과 차량번호를 모두 입력해주세요.');return;}
  setIsSavingProfile(true);setProfileSaveError('');setProfileSaveMessage('');
  try{
   const {error}=await supabase.from('profiles').update({full_name:name,vehicle_number:vehicle}).eq('id',authUser.id);
   if(error)throw error;
   await refreshProfile();setProfileSaveMessage('이름과 차량번호가 내정보에 저장되었습니다.');
  }catch(error){console.error('[DailyInspection] 내정보 저장 실패:',error);setProfileSaveError(error.message||'내정보 저장에 실패했습니다.');}
  finally{setIsSavingProfile(false);}
 };

 const handleSave=async()=>{
  if(!canSave)return;
  setSaveError('');
  const normalizedCompanyName=transportCompanyName.trim();
  const normalizedName=driverName.trim(),normalizedVehicle=vehicleNumber.trim();
  try{
   if(authUser?.id&&(hasMissingIdentity||identityChanged)){
    setIsSavingProfile(true);
    const {error}=await supabase.from('profiles').update({full_name:normalizedName,vehicle_number:normalizedVehicle}).eq('id',authUser.id);
    if(error)throw error;
    await refreshProfile();
    setProfileSaveMessage('이름과 차량번호가 내정보에 자동 저장되었습니다.');
   }
   const record=await saveDailyInspectionRecord(userId,date,{
    answers,actionNotes:actionNotes.trim(),transportCompanyName:normalizedCompanyName,driverName:normalizedName,vehicleNumber:normalizedVehicle,
    driverSignature,correctionReason:correctionReason.trim(),supersedesId:currentRecord?.id||null,
    isNotOperated:false,completed:true
   });
   try{saveSavedTransportCompanyName(userId,normalizedCompanyName);}catch(storageError){console.warn("[DailyInspection] 운송사업자명 자동 저장 실패:",storageError);}
   setCurrentRecord(record);setIsSaved(true);setCorrectionReason('');
   const [selectedYear,selectedMonthNumber]=selectedMonth.split('-');
   setMonthRecords(listDailyInspectionRecords(userId,selectedYear,selectedMonthNumber));
   onSaved?.(record);
  }catch(error){console.error('[DailyInspection] 점검 기록 저장 실패:',error);setSaveError(error.message||'점검 기록을 저장하지 못했습니다.');}
  finally{setIsSavingProfile(false);}
 };

 const changeSelectedMonth=(delta)=>{
  if(!selectedMonth)return;
  const [year,month]=selectedMonth.split('-').map(Number);
  const next=new Date(year,month-1+delta,1);
  setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`);
 };
 const handlePrint=()=>{
  try{
   const [year,month]=selectedMonth.split('-');
   const records=listDailyInspectionRecords(userId,year,month);
   if(!records.length&&currentRecord&&String(currentRecord.inspectionDate||currentRecord.date||'').startsWith(`${selectedMonth}-`))records.push(currentRecord);
   if(!records.length){setSaveError('선택한 달에 출력할 점검 기록이 없습니다.');return;}
   printDailyInspectionMonth(records,year,Number(month));
  }catch(error){setSaveError(error.message||'인쇄 화면을 열지 못했습니다.');}
 };

 const dark=Boolean(isDarkMode);
 const panelClass=dark?'bg-slate-800 border-slate-700 text-slate-100':'bg-white border-slate-200 text-slate-900';
 const mutedClass=dark?'text-slate-400':'text-slate-500';
 const fieldClass=`mt-1 w-full min-w-0 rounded-lg border px-2.5 py-2 text-sm ${dark?'bg-slate-900 border-slate-600 text-white':'bg-white border-slate-300 text-slate-900'}`;

 return <div className="w-full max-w-3xl mx-auto px-2 sm:px-4 pb-8">
  <div className="flex items-center gap-2 mb-4 pt-2">
   <button type="button" onClick={onBack} aria-label="뒤로" className={`p-2 rounded-full ${dark?'hover:bg-slate-800 text-slate-200':'hover:bg-slate-100 text-slate-700'}`}><ArrowLeft size={22}/></button>
   <div className="min-w-0 flex-1"><h2 className="text-lg sm:text-xl font-black break-keep">화물자동차 안전사고 예방을 위한 일상점검표</h2><p className={`mt-0.5 text-xs ${mutedClass}`}>{formatDateLabel(date)}</p></div>
  </div>

  <section className={`rounded-2xl border p-3 mb-3 ${panelClass}`}>
   <div className="grid grid-cols-2 gap-3">
    <label className="col-span-2 flex w-full min-w-0 flex-col items-stretch text-center text-xs">
     <span className="mb-1 text-center">운송사업자명</span>
     <input value={transportCompanyName} onChange={e=>setTransportCompanyName(e.target.value)} maxLength={100} placeholder="운송사업자명 입력" className={`${fieldClass} block w-full text-center`} style={{textAlign:"center"}}/>
    </label>
    <label className="flex w-full min-w-0 flex-col items-stretch text-center text-xs">
     <span className="mb-1 text-center">운전자(점검자) 성명</span>
     <input value={driverName} onChange={e=>setDriverName(e.target.value)} maxLength={60} placeholder="이름 입력" className={`${fieldClass} block w-full text-center`} style={{textAlign:"center"}}/>
    </label>
    <label className="flex w-full min-w-0 flex-col items-stretch text-center text-xs">
     <span className="mb-1 text-center">차량번호</span>
     <input value={vehicleNumber} onChange={e=>setVehicleNumber(e.target.value)} maxLength={30} placeholder="차량번호 입력" className={`${fieldClass} block w-full text-center`} style={{textAlign:"center"}}/>
    </label>
   </div>
   <p className={`mt-2 text-xs ${mutedClass}`}>운송사업자명은 한 번 입력하면 이 기기에 저장되어 다음 점검에도 자동 입력됩니다.</p>
   {(hasMissingIdentity||identityChanged)&&<div className="mt-3">
    <p className={`mb-2 text-xs ${mutedClass}`}>점검 완료 저장 시 로그인 계정의 내정보에도 이름과 차량번호가 반영됩니다.</p>
    <button type="button" onClick={handleSaveIdentity} disabled={!authUser?.id||!driverName.trim()||!vehicleNumber.trim()||isSavingProfile} className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-40">{isSavingProfile?'내정보 저장 중...':'입력한 정보를 내정보에 저장'}</button>
    {!authUser?.id&&<p className={`mt-2 text-xs ${mutedClass}`}>로그인하면 입력한 정보를 내정보에 저장할 수 있습니다.</p>}
   </div>}
   {profileSaveMessage&&<p className="mt-2 text-xs font-semibold text-emerald-600">{profileSaveMessage}</p>}
   {profileSaveError&&<p className="mt-2 text-xs text-red-500">{profileSaveError}</p>}
   {scheduleStatus==='off'&&<p className="mt-3 text-xs text-slate-500">오늘은 근무표상 휴무일입니다. 차량을 운행하지 않는다면 점검 기록을 남기지 않아도 됩니다.</p>}
   {scheduleStatus==='pending'&&<p className="mt-3 text-xs text-amber-600">오늘 근무표가 아직 확정되지 않았습니다. 실제 운행한다면 운행 전에 점검하세요.</p>}
  </section>

  <section className={`rounded-2xl border p-3 mb-3 ${panelClass}`}>
   <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><ClipboardCheck size={18} className="text-blue-500"/><h3 className="font-black">차량 점검 항목</h3></div><span className="text-sm font-bold tabular-nums">{answeredCount}/{ALL_ITEMS.length}</span></div>
   <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${dark?'bg-slate-700':'bg-slate-100'}`}><div className="h-full rounded-full bg-blue-500 transition-all" style={{width:`${answeredCount/ALL_ITEMS.length*100}%`}}/></div>
  </section>

  {INSPECTION_GROUPS.map((group,groupIndex)=><section key={group.title} className={`rounded-2xl border p-3 mb-3 ${panelClass}`}>
   <h3 className="font-black text-base sm:text-lg mb-3">{groupIndex+1}. {group.title}</h3>
   {group.items.map((item,itemIndex)=>{
    const answer=answers[item.id];
    const itemNumber=`${groupIndex+1}-${itemIndex+1}`;
    return <div key={item.id} className="py-3 border-t first:border-t-0 border-slate-200 dark:border-slate-700">
     <p className="w-full overflow-x-auto whitespace-nowrap text-[16px] sm:text-lg font-semibold leading-7" title={`${itemNumber}. ${item.label}`}>
      <span className="mr-2 font-black text-blue-600 dark:text-blue-400">{itemNumber}</span>{item.label}{item.extra&&<span className="ml-2 text-xs font-bold text-blue-500">추가점검</span>}
     </p>
     <div className="grid grid-cols-2 gap-1.5 mt-2">
      <button type="button" onClick={()=>chooseAnswer(item.id,'good')} aria-pressed={answer==='good'} className={`h-10 min-h-0 min-w-0 w-full rounded-lg border px-2 py-1.5 text-[15px] font-black leading-none whitespace-nowrap ${answer==='good'?'border-emerald-500 bg-emerald-500 text-white':dark?'border-slate-600 text-slate-200':'border-slate-300 text-slate-700'}`}>○ 양호</button>
      <button type="button" onClick={()=>chooseAnswer(item.id,'bad')} aria-pressed={answer==='bad'} className={`h-10 min-h-0 min-w-0 w-full rounded-lg border px-2 py-1.5 text-[15px] font-black leading-none whitespace-nowrap ${answer==='bad'?'border-red-500 bg-red-500 text-white':dark?'border-slate-600 text-slate-200':'border-slate-300 text-slate-700'}`}>× 불량</button>
     </div>
    </div>;
   })}
  </section>)}

  <button type="button" onClick={markAllAsGood} aria-pressed={allGoodSelected} className={`w-full min-h-[50px] rounded-xl border-2 px-4 py-3 mb-3 text-base font-black transition-colors ${allGoodSelected?'border-emerald-600 bg-emerald-600 text-white shadow-sm':'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}>
   {allGoodSelected?'✓ 모두 양호 선택됨':'모두 양호로 선택'}
  </button>

  <section className={`rounded-2xl border p-3 mb-3 ${panelClass}`}>
   <label htmlFor="daily-inspection-action-notes" className="block font-black text-sm">불량상태 조치 기록 <span className={`ml-1 text-xs font-medium ${mutedClass}`}>불량 항목이 있을 때 필수</span></label>
   <textarea id="daily-inspection-action-notes" value={actionNotes} onChange={e=>{setActionNotes(e.target.value);setIsSaved(false);}} rows={3} placeholder="예: 00일 창닦이기 불량 - 00일 창닦이기 교체" className={`mt-2 w-full rounded-lg border p-3 text-sm ${dark?'bg-slate-900 border-slate-600 text-white':'bg-white border-slate-300 text-slate-900'}`}/>
   {badItems.length>0&&<p className="mt-2 text-xs text-red-500">불량 항목 {badItems.length}개가 있습니다. 조치 내용까지 입력해야 완료 처리됩니다.</p>}
  </section>

  <section className={`rounded-2xl border p-3 mb-3 ${panelClass}`}>
   <h3 className="font-black text-sm mb-3">전자서명</h3>
   <div className="mb-3"><SignaturePad value={driverSignature} onChange={v=>{setDriverSignature(v);setIsSaved(false);setSignatureMessage('');}} label="운전자(점검자) 자필 서명" isDarkMode={dark}/></div>
   <div className="grid grid-cols-2 gap-2">
    <button type="button" onClick={handleSaveSignature} disabled={!driverSignature} className="min-h-10 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">현재 서명 저장</button>
    <button type="button" onClick={handleLoadSavedSignature} disabled={!savedDriverSignature} className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40 ${dark?'border-slate-600 text-slate-200':'border-slate-300 text-slate-700'}`}>저장한 서명 불러오기</button>
   </div>
   <p className={`mt-2 text-xs leading-5 ${mutedClass}`}>{savedDriverSignature?'저장된 서명이 있습니다. 새 점검을 열면 자동으로 불러옵니다.':'한 번 서명을 저장하면 다음 점검부터 자동으로 사용할 수 있습니다.'}</p>
   {signatureMessage&&<p className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-300">{signatureMessage}</p>}
  </section>

  {currentRecord&&<section className={`rounded-2xl border p-3 mb-3 ${panelClass}`}>
   <h3 className="font-black text-sm">기존 완료 기록 수정</h3>
   <p className={`mt-1 text-xs ${mutedClass}`}>같은 날짜로 다시 저장하면 이전 점검 기록은 삭제되고 최신 기록 하나만 남습니다. 변경 사유를 입력해주세요.</p>
   <label className="block mt-2 text-xs">정정 사유(필수)<textarea value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)} rows={2} placeholder="정정이 필요한 이유를 입력하세요." className={fieldClass}/></label>
  </section>}

  {saveError&&<p className="mb-3 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600">{saveError}</p>}
  {isSaved&&<p className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-600"><CheckCircle2 size={17}/> 점검 기록이 기기에 저장되어 있습니다.</p>}
  <button type="button" onClick={handleSave} disabled={!canSave||isSavingProfile} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-black text-white disabled:opacity-40">{isSavingProfile?'저장 중...':currentRecord?'기존 기록 덮어쓰기':'점검 완료 저장'}</button>
  {!canSave&&<p className={`mt-2 text-center text-xs ${mutedClass}`}>운송사업자명, 모든 점검 항목, 운전자 서명 및 필수 조치·정정 내용을 입력해야 저장됩니다.</p>}
  {currentRecord&&<p className={`mt-2 text-center text-xs ${mutedClass}`}>최근 저장 시각(기기): {formatTimestamp(currentRecord.completedAt||currentRecord.updatedAt)} · 같은 날짜 기록은 최신본 1건만 보관</p>}

  <section className={`rounded-2xl border p-3 mt-5 ${panelClass}`}>
   <div className="flex items-center justify-between gap-2 mb-3">
    <div className="flex items-center gap-2"><History size={17}/><h3 className="font-black text-sm">월별 기록 및 출력</h3></div>
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${dark?'bg-slate-700 text-slate-200':'bg-slate-100 text-slate-600'}`}>{monthRecords.length}건</span>
   </div>
   <div className={`flex items-center gap-2 rounded-xl border p-2 ${dark?'border-slate-700 bg-slate-900/70':'border-slate-200 bg-slate-50'}`}>
    <button type="button" onClick={()=>changeSelectedMonth(-1)} aria-label="이전 달" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${dark?'bg-slate-800 text-slate-200':'bg-white text-slate-700 shadow-sm'}`}><ChevronLeft size={19}/></button>
    <label className="relative min-w-0 flex-1">
     <CalendarDays size={16} className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 ${mutedClass}`}/>
     <input aria-label="출력할 월 선택" type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className={`h-10 w-full min-w-0 appearance-none rounded-lg border-0 bg-transparent pl-9 pr-1 text-center text-sm font-bold tabular-nums outline-none ${dark?'text-white':'text-slate-900'}`}/>
    </label>
    <button type="button" onClick={()=>changeSelectedMonth(1)} aria-label="다음 달" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${dark?'bg-slate-800 text-slate-200':'bg-white text-slate-700 shadow-sm'}`}><ChevronRight size={19}/></button>
   </div>
   <button type="button" onClick={handlePrint} disabled={!monthRecords.length} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-blue-600"><Printer size={17}/> {selectedMonth.replace('-', '년 ')}월 저장/공유</button>
   <p className={`mt-2 text-center text-xs leading-5 ${mutedClass}`}>선택한 월의 점검 기록 {monthRecords.length}건을 공식 서식 PDF로 저장하거나 공유합니다.</p>
  </section>

  <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
   <p className="text-xs font-bold">현장 보관 안내</p>
   <p className="mt-1 text-xs leading-5">모바일 기록만으로 모든 단속·제출 요건을 충족한다고 단정할 수 없습니다. 운수회사와 관할 기관에 모바일 기록 인정 여부를 확인하고, 보수적으로는 월별 점검표를 정기적으로 출력해 차량 내 서류함(글로브박스)에 함께 보관하세요.</p>
  </section>
  <p className={`mt-3 text-center text-[11px] leading-5 ${mutedClass}`}>현재 기록은 이 기기의 앱 저장소에 보관됩니다. 기기 시각은 서버가 인증한 타임스탬프가 아니며, 앱 삭제·기기 변경 시 기록이 사라질 수 있으므로 출력본도 보관하세요.</p>
 </div>;
};
export default DailyInspectionView;
