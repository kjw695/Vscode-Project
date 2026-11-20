import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CircleAlert, ClipboardCheck } from 'lucide-react';
import { readDailyInspectionRecord, saveDailyInspectionRecord } from '../../services/dailyInspectionService';

const INSPECTION_GROUPS = [
    {
        title: '외관점검',
        items: [
            { id: 'cleanliness', label: '번호판, 전면유리, 후사경 등의 청결상태' },
            { id: 'lighting', label: '후미등, 차폭등 등 등화장치 작동상태' },
            { id: 'wipers', label: '창닦이기(와이퍼) 작동상태' },
            { id: 'cargoBody', label: '적재함(보조지지대 포함), 측면 보호대, 후부반사판, 트레일러 연결장치의 부착 상태 및 훼손 여부' }
        ]
    },
    {
        title: '상태점검',
        items: [
            { id: 'tires', label: '타이어 손상 및 마모(1.6mm 이상) 여부' },
            { id: 'cargoFixing', label: '화물, 적재함 지지대(판스프링) 등의 고정상태' },
            { id: 'wheelNuts', label: '바퀴 너트 등 균열 여부' }
        ]
    },
    {
        title: '기타',
        items: [
            { id: 'fluidsAndWarning', label: '냉각수, 공기압, 엔진오일 등 차량 이상 여부(계기판 확인)' },
            { id: 'seatBelt', label: '좌석 안전띠 상태' },
            { id: 'fireExtinguisher', label: '소화기 비치 여부' },
            { id: 'warningTriangle', label: '안전삼각대 등 비치 여부' }
        ]
    }
];

const ALL_ITEMS = INSPECTION_GROUPS.flatMap((group) => group.items);

const formatDateLabel = (dateKey) => {
    if (!dateKey) return '';
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${year}년 ${month}월 ${day}일 (${weekdays[date.getDay()]})`;
};

const DailyInspectionView = ({
    onBack,
    onSaved,
    date,
    userId,
    profile,
    isDarkMode,
    scheduleStatus = 'work'
}) => {
    const [answers, setAnswers] = useState({});
    const [actionNotes, setActionNotes] = useState('');
    const [saveError, setSaveError] = useState('');
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        const record = readDailyInspectionRecord(userId, date);
        setAnswers(record?.answers && typeof record.answers === 'object' ? record.answers : {});
        setActionNotes(record?.actionNotes || '');
        setIsSaved(Boolean(record?.updatedAt));
        setSaveError('');
    }, [userId, date]);

    const answeredCount = useMemo(
        () => ALL_ITEMS.filter((item) => ['good', 'bad'].includes(answers[item.id])).length,
        [answers]
    );
    const badItems = useMemo(
        () => ALL_ITEMS.filter((item) => answers[item.id] === 'bad'),
        [answers]
    );
    const allAnswered = answeredCount === ALL_ITEMS.length;
    const canSave = allAnswered && (badItems.length === 0 || actionNotes.trim().length > 0);

    const chooseAnswer = (itemId, value) => {
        setAnswers((previous) => ({ ...previous, [itemId]: value }));
        setIsSaved(false);
        setSaveError('');
    };

    const handleSave = () => {
        if (!canSave) return;
        setSaveError('');
        try {
            const record = saveDailyInspectionRecord(userId, date, {
                answers,
                actionNotes: actionNotes.trim(),
                driverName: profile?.full_name || profile?.display_name || '',
                vehicleNumber: profile?.vehicle_number || '',
                completed: true
            });
            setIsSaved(true);
            onSaved?.(record);
        } catch (error) {
            setSaveError(error.message || '점검 기록을 저장하지 못했습니다.');
        }
    };

    const dark = Boolean(isDarkMode);
    const panelClass = dark
        ? 'bg-slate-800 border-slate-700 text-slate-100'
        : 'bg-white border-slate-200 text-slate-900';
    const mutedClass = dark ? 'text-slate-400' : 'text-slate-500';

    return (
        <div className="w-full max-w-3xl mx-auto px-2 sm:px-4 pb-8">
            <div className="flex items-center gap-2 mb-4 pt-2">
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="뒤로"
                    className={`p-2 rounded-full ${dark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                >
                    <ArrowLeft size={22} />
                </button>
                <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl font-black break-keep">화물자동차 안전사고 예방을 위한 일상점검표</h2>
                    <p className={`mt-0.5 text-xs ${mutedClass}`}>{formatDateLabel(date)}</p>
                </div>
            </div>

            <section className={`rounded-2xl border p-3 mb-3 ${panelClass}`}>
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className={`text-xs ${mutedClass}`}>운수종사자</p>
                        <p className="font-bold truncate">{profile?.full_name || profile?.display_name || '이름 미등록'}</p>
                    </div>
                    <div className="min-w-0 text-right">
                        <p className={`text-xs ${mutedClass}`}>차량번호</p>
                        <p className="font-bold truncate">{profile?.vehicle_number || '차량번호 미등록'}</p>
                    </div>
                </div>
                {scheduleStatus === 'off' && (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        오늘은 근무표상 휴무일입니다. 차량을 운행하지 않는다면 점검 기록을 남기지 않아도 됩니다.
                    </p>
                )}
                {scheduleStatus === 'pending' && (
                    <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
                        오늘 근무표가 아직 확정되지 않았습니다. 차량을 운행한다면 운행 전에 점검을 진행하세요.
                    </p>
                )}
            </section>

            <section className={`rounded-2xl border p-3 mb-3 ${panelClass}`}>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <ClipboardCheck size={18} className="text-blue-500" />
                        <h3 className="font-black">차량 점검 항목</h3>
                    </div>
                    <span className="text-sm font-bold tabular-nums">{answeredCount}/{ALL_ITEMS.length}</span>
                </div>
                <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${dark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${(answeredCount / ALL_ITEMS.length) * 100}%` }}
                    />
                </div>
            </section>

            {INSPECTION_GROUPS.map((group) => (
                <section key={group.title} className={`rounded-2xl border p-3 mb-3 ${panelClass}`}>
                    <h3 className="font-black text-sm mb-2">{group.title}</h3>
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        {group.items.map((item, index) => {
                            const answer = answers[item.id];
                            return (
                                <div key={item.id} className="py-3 first:pt-1 last:pb-1">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium leading-5">
                                                <span className={`mr-1.5 text-xs font-bold ${mutedClass}`}>{index + 1}.</span>
                                                {item.label}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => chooseAnswer(item.id, 'good')}
                                                aria-pressed={answer === 'good'}
                                                className={`min-w-[58px] rounded-lg border px-2.5 py-2 text-xs font-bold transition-colors ${
                                                    answer === 'good'
                                                        ? 'border-emerald-500 bg-emerald-500 text-white'
                                                        : (dark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600')
                                                }`}
                                            >
                                                ○ 양호
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => chooseAnswer(item.id, 'bad')}
                                                aria-pressed={answer === 'bad'}
                                                className={`min-w-[58px] rounded-lg border px-2.5 py-2 text-xs font-bold transition-colors ${
                                                    answer === 'bad'
                                                        ? 'border-red-500 bg-red-500 text-white'
                                                        : (dark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600')
                                                }`}
                                            >
                                                × 불량
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}

            <section className={`rounded-2xl border p-3 mb-3 ${panelClass}`}>
                <label htmlFor="daily-inspection-action-notes" className="block font-black text-sm">
                    불량상태 조치 기록
                    <span className={`ml-2 text-xs font-medium ${mutedClass}`}>불량 항목이 있을 때 작성</span>
                </label>
                <textarea
                    id="daily-inspection-action-notes"
                    value={actionNotes}
                    onChange={(event) => {
                        setActionNotes(event.target.value);
                        setIsSaved(false);
                    }}
                    rows={3}
                    placeholder="예: 21일 우측 후미등 불량 확인 - 정비소에서 전구 교체"
                    className={`mt-2 w-full rounded-lg border p-3 text-sm leading-5 outline-none focus:ring-2 focus:ring-blue-500 ${
                        dark ? 'bg-slate-900 border-slate-600 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                />
                {badItems.length > 0 && (
                    <p className="mt-2 text-xs text-red-500">
                        불량 항목 {badItems.length}개가 있습니다. 조치 내용까지 입력해야 완료로 저장됩니다.
                    </p>
                )}
            </section>

            {saveError && (
                <p className="mb-3 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-300">
                    {saveError}
                </p>
            )}

            {isSaved && (
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={17} /> 오늘 점검 기록이 저장되었습니다.
                </p>
            )}

            <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-black text-white disabled:opacity-40"
            >
                {isSaved ? '점검 결과 수정 저장' : '점검 완료 저장'}
            </button>
            {!canSave && (
                <p className={`mt-2 text-center text-xs ${mutedClass}`}>
                    모든 항목을 양호 또는 불량으로 선택해야 완료 처리됩니다.
                </p>
            )}
            <p className={`mt-4 text-center text-[11px] leading-5 ${mutedClass}`}>
                점검 기록은 현재 이 기기의 앱 저장소에 보관됩니다.
            </p>
        </div>
    );
};

export default DailyInspectionView;
