import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Check, Clock3, Eye, Loader2, RotateCcw, Save, Trash2, X } from 'lucide-react';
import {
    deleteMyOrganizationScheduleTemplate,
    fetchMyOrganizationScheduleTemplate,
    fetchMyOrganizationScheduleTemplates,
    fetchMyOrganizationWeeklyScheduleHistory,
    fetchMyOrganizationWeeklyScheduleHistoryItem,
    saveMyOrganizationScheduleTemplate
} from '../services/organizationScheduleService';

const dateLabel = value => value ? new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '시간 정보 없음';
const counts = schedule => {
    const days=Object.values(schedule||{});
    return {days:days.length,offs:days.reduce((sum,day)=>sum+(Array.isArray(day?.offEmployeeIds)?day.offEmployeeIds.length:(day?.offs?.length||0)+(day?.subOffs?.length||0)),0)};
};
const changeLabel = type => ({created:'최초 저장',draft_saved:'임시 저장',confirmed:'확정',reopened:'확정 해제',updated:'수정',restored:'이전 버전 복구',admin_changed:'관리자 변경'}[type]||'변경');

export default function ScheduleToolsPanel({open,onClose,teamId,teamLabel,weekStart,weekEnd,generatedSchedule,warnings,currentVersion,onLoadTemplate,onRestoreHistory}) {
    const [tab,setTab]=useState('templates'),[templates,setTemplates]=useState([]),[history,setHistory]=useState([]);
    const [selectedTemplate,setSelectedTemplate]=useState(null),[selectedHistory,setSelectedHistory]=useState(null);
    const [templateName,setTemplateName]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
    const [error,setError]=useState(''),[notice,setNotice]=useState('');
    const load=useCallback(async()=>{
        if(!open||!teamId)return;
        setLoading(true);setError('');
        try{const [a,b]=await Promise.all([fetchMyOrganizationScheduleTemplates(teamId),fetchMyOrganizationWeeklyScheduleHistory(teamId,weekStart,50)]);setTemplates(a);setHistory(b);}
        catch(e){setError(e?.message||'근무표 도구를 불러오지 못했습니다.');}
        finally{setLoading(false);}
    },[open,teamId,weekStart]);
    useEffect(()=>{load();},[load]);
    const saveTemplate=async event=>{
        event.preventDefault();if(!templateName.trim()||!Object.keys(generatedSchedule||{}).length)return;
        setBusy(true);setError('');setNotice('');
        try{await saveMyOrganizationScheduleTemplate({teamId,teamLabel,templateName:templateName.trim(),schedule:generatedSchedule,warnings});setTemplateName('');setNotice('현재 초안을 템플릿으로 저장했습니다.');await load();}
        catch(e){setError(e?.message||'템플릿 저장에 실패했습니다.');}finally{setBusy(false);}
    };
    const previewTemplate=async id=>{setBusy(true);setError('');try{setSelectedTemplate(await fetchMyOrganizationScheduleTemplate(id));}catch(e){setError(e?.message||'템플릿을 불러오지 못했습니다.');}finally{setBusy(false);}};
    const removeTemplate=async id=>{
        if(!window.confirm('이 템플릿을 삭제할까요? 이미 저장된 근무표는 바뀌지 않습니다.'))return;
        setBusy(true);setError('');try{await deleteMyOrganizationScheduleTemplate(id);if(selectedTemplate?.id===id)setSelectedTemplate(null);await load();}
        catch(e){setError(e?.message||'템플릿 삭제에 실패했습니다.');}finally{setBusy(false);}
    };
    const previewHistory=async id=>{setBusy(true);setError('');try{setSelectedHistory(await fetchMyOrganizationWeeklyScheduleHistoryItem(id));}catch(e){setError(e?.message||'변경 이력을 불러오지 못했습니다.');}finally{setBusy(false);}};
    const restore=async()=>{
        if(!selectedHistory)return;setBusy(true);setError('');
        try{await onRestoreHistory(selectedHistory);setSelectedHistory(null);setNotice('복구했습니다. 현재 상태도 새 이력으로 보관했습니다.');await load();}
        catch(e){setError(e?.message||'이전 이력 복구에 실패했습니다.');}finally{setBusy(false);}
    };
    if(!open)return null;
    const templateCount=counts(selectedTemplate?.schedule),historyCount=counts(selectedHistory?.schedule);
    return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
       <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div className="min-w-0"><h2 className="flex items-center gap-2 text-base font-black"><Archive size={18} className="text-indigo-600"/>근무표 도구</h2><p className="mt-1 truncate text-xs text-slate-500">{teamLabel} · {weekStart} ~ {weekEnd}</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500"><X size={18}/></button></header>
       <div className="flex gap-2 border-b border-slate-100 px-4 py-2"><button type="button" onClick={()=>{setTab('templates');setSelectedHistory(null);}} className={'rounded-lg px-3 py-2 text-xs font-bold '+(tab==='templates'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-600')}>템플릿</button><button type="button" onClick={()=>{setTab('history');setSelectedTemplate(null);}} className={'rounded-lg px-3 py-2 text-xs font-bold '+(tab==='history'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-600')}>변경 이력</button></div>
       <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error&&<p className="mb-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}{notice&&<p className="mb-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</p>}
        {loading?<div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={18} className="animate-spin"/>불러오는 중</div>:tab==='templates'?<>
         <form onSubmit={saveTemplate} className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><h3 className="mb-2 text-sm font-black">현재 초안 템플릿 저장</h3><div className="flex gap-2"><input value={templateName} onChange={e=>setTemplateName(e.target.value)} maxLength={40} placeholder="예: 기본 주간 / 월말 운영" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/><button type="submit" disabled={busy||!templateName.trim()||!Object.keys(generatedSchedule||{}).length} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Save size={13}/>저장</button></div><p className="mt-2 text-[11px] text-slate-500">템플릿은 팀별로 보관됩니다. 적용해도 직원 앱의 확정 일정은 바뀌지 않습니다.</p></form>
         {templates.length?<div className="space-y-2">{templates.map(item=><article key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.template_name}</p><p className="mt-1 text-[11px] text-slate-400">수정 {dateLabel(item.updated_at)}</p></div><div className="flex shrink-0 gap-1"><button type="button" onClick={()=>previewTemplate(item.id)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-bold"><Eye size={13}/>보기</button><button type="button" onClick={()=>removeTemplate(item.id)} disabled={busy} className="rounded-lg border border-rose-100 px-2.5 py-2 text-rose-600"><Trash2 size={14}/></button></div></article>)}</div>:<p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-400">저장된 템플릿이 없습니다.</p>}
         {selectedTemplate&&<div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3"><p className="text-sm font-black">{selectedTemplate.template_name}</p><p className="mt-1 text-xs text-slate-500">일정 {templateCount.days}일 · 휴무 지정 {templateCount.offs}건</p><button type="button" onClick={()=>onLoadTemplate(selectedTemplate)} disabled={busy} className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white"><Check size={14}/>이번 주 초안에 적용</button></div>}
        </>:<>
         {history.length?<div className="space-y-2">{history.map(item=><button key={item.id} type="button" onClick={()=>previewHistory(item.id)} disabled={busy} className={'w-full rounded-xl border p-3 text-left '+(selectedHistory?.id===item.id?'border-indigo-300 bg-indigo-50':'border-slate-100 bg-white')}><div className="flex items-center justify-between gap-2"><span className="text-sm font-bold">버전 {item.version} · {changeLabel(item.change_type)}</span><span className="rounded-md bg-slate-100 px-2 py-1 text-[10px]">{item.status==='confirmed'?'확정':'임시'}</span></div><p className="mt-1 text-[11px] text-slate-400">{dateLabel(item.created_at)} · 경고 {item.warnings_count}건</p>{item.change_reason&&<p className="mt-1 text-xs leading-5 text-slate-600">사유: {item.change_reason}</p>}</button>)}</div>:<p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-400">이 주간의 변경 이력이 없습니다.</p>}
         {selectedHistory&&<div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3"><div className="flex items-center justify-between"><div><p className="text-sm font-black">버전 {selectedHistory.version} 미리보기</p><p className="mt-1 text-xs text-slate-500">{selectedHistory.status==='confirmed'?'확정':'임시'} · 일정 {historyCount.days}일 · 휴무 {historyCount.offs}건</p>{selectedHistory.change_reason&&<p className="mt-2 text-xs leading-5 text-slate-600">변경 사유: {selectedHistory.change_reason}</p>}</div><Clock3 size={18} className="text-indigo-500"/></div><button type="button" onClick={restore} disabled={busy||Number(selectedHistory.version)===Number(currentVersion)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40"><RotateCcw size={14}/>이 버전으로 복구</button></div>}
        </>}
       </div>
       <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3"><span className="text-[11px] text-slate-400">{tab==='templates'?templates.length+'개 템플릿':history.length+'개 이력'}</span><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-xs font-bold text-slate-600">닫기</button></footer>
      </div>
    </div>;
}
