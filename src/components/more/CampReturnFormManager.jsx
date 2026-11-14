import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    ExternalLink,
    Link2,
    RefreshCw,
    Trash2,
    AlertCircle,
    ClipboardList
} from 'lucide-react';
import {
    analyzeCampReturnForm,
    fetchCampReturnForms,
    saveCampReturnForm,
    deleteCampReturnForm,
    checkCampReturnFormAdmin,
    fetchCampReturnFormReports
} from '../../services/campReturnNumberingService';

const EMPTY_MAPPING = {
    invoice_entry_id: '',
    driver_id_entry_id: '',
    quantity_entry_id: '',
    camp_entry_id: '',
    camp_choice_value: '',
    static_fields: []
};

function statusLabel(status) {
    if (status === 'ready') return '자동 연결 가능';
    if (status === 'needs_mapping') return '항목 확인 필요';
    return '분석 오류';
}

export default function CampReturnFormManager({ onBack, isDarkMode, user, showMessage }) {
    const userId = user?.id || null;
    const isDark = !!isDarkMode;
    const [campName, setCampName] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [mapping, setMapping] = useState(EMPTY_MAPPING);
    const [forms, setForms] = useState([]);
    const [reports, setReports] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState('');
    const [loadError, setLoadError] = useState('');

    const panelClass = isDark
        ? 'bg-gray-800 border-gray-700 text-gray-100'
        : 'bg-white border-gray-200 text-gray-900';
    const inputClass = `w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`;
    const mutedClass = isDark ? 'text-gray-400' : 'text-gray-500';

    const loadData = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            setForms([]);
            setReports([]);
            setIsAdmin(false);
            return;
        }

        setLoading(true);
        setLoadError('');
        try {
            const [savedForms, adminAccess] = await Promise.all([
                fetchCampReturnForms(userId),
                checkCampReturnFormAdmin()
            ]);
            setForms(savedForms);
            setIsAdmin(adminAccess);
            if (adminAccess) {
                const adminReports = await fetchCampReturnFormReports();
                setReports(adminReports);
            } else {
                setReports([]);
            }
        } catch (error) {
            console.error('[CampReturnFormManager] 데이터 조회 실패:', error);
            setLoadError(error?.message || '양식 정보를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const questions = useMemo(() => analysis?.questions || [], [analysis]);
    const detectedCampQuestion = questions.find(question => /(요청\s*캠프|캠프|거점)/i.test(question.label));
    const needsCampMapping = Boolean(detectedCampQuestion?.required);
    const questionOptions = useMemo(
        () => questions.map(question => ({
            value: String(question.entry_id),
            label: `${question.label} · entry.${question.entry_id}`
        })),
        [questions]
    );
    const selectedCampQuestion = questions.find(
        question => String(question.entry_id) === String(mapping.camp_entry_id)
    );
    const campChoiceOptions = useMemo(
        () => Array.isArray(selectedCampQuestion?.choices)
            ? selectedCampQuestion.choices.filter(Boolean)
            : [],
        [selectedCampQuestion]
    );

    useEffect(() => {
        if (!mapping.camp_entry_id || campChoiceOptions.length === 0) return;

        setMapping(current => {
            if (campChoiceOptions.includes(current.camp_choice_value)) return current;

            const normalize = value => String(value || '')
                .toLocaleLowerCase()
                .replace(/\s+/g, '')
                .replace(/[()（）]/g, '');
            const campValue = normalize(campName);
            const exactMatches = campChoiceOptions.filter(
                option => normalize(option) === campValue
            );
            const partialMatches = campChoiceOptions.filter(option => {
                const optionValue = normalize(option);
                return campValue && (
                    optionValue.includes(campValue) ||
                    campValue.includes(optionValue)
                );
            });

            const guessedValue = exactMatches.length === 1
                ? exactMatches[0]
                : partialMatches.length === 1
                    ? partialMatches[0]
                    : campChoiceOptions.length === 1
                        ? campChoiceOptions[0]
                        : '';

            return current.camp_choice_value === guessedValue
                ? current
                : { ...current, camp_choice_value: guessedValue };
        });
    }, [mapping.camp_entry_id, campChoiceOptions, campName]);

    const updateMapping = (key, value) => {
        setMapping(current => ({ ...current, [key]: value || '' }));
    };

    const handleAnalyze = async () => {
        if (!userId) {
            showMessage?.('타지역 양식 등록은 로그인 후 이용할 수 있습니다.');
            return;
        }
        if (!campName.trim()) {
            showMessage?.('캠프명을 입력해주세요.');
            return;
        }
        if (!formUrl.trim()) {
            showMessage?.('Google Forms 링크를 입력해주세요.');
            return;
        }

        setAnalyzing(true);
        setAnalysis(null);
        setMapping(EMPTY_MAPPING);
        try {
            const result = await analyzeCampReturnForm(formUrl.trim(), campName.trim());
            setAnalysis(result);
            setFormUrl(result.form_url || formUrl.trim());
            setMapping({
                ...EMPTY_MAPPING,
                ...(result.suggested_mapping || {})
            });
            showMessage?.(
                result.status === 'ready'
                    ? '양식 분석을 마쳤습니다. 연결 항목을 확인하고 등록해주세요.'
                    : '링크는 수집했습니다. 자동으로 찾지 못한 입력 항목을 직접 지정해주세요.'
            );
            await loadData();
        } catch (error) {
            console.error('[CampReturnFormManager] 양식 분석 실패:', error);
            showMessage?.(error?.message || '양식을 분석하지 못했습니다. 오류 내역은 관리자 접수 목록에 기록됩니다.');
            await loadData();
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSave = async () => {
        if (!userId || !analysis) return;
        if (
            !mapping.invoice_entry_id ||
            !mapping.driver_id_entry_id ||
            !mapping.quantity_entry_id ||
            (needsCampMapping && !mapping.camp_entry_id)
        ) {
            showMessage?.('운송장번호, 기사님 아이디, 채번 수량' + (needsCampMapping ? ', 요청 캠프' : '') + ' 항목을 모두 연결해주세요.');
            return;
        }

        setSaving(true);
        try {
            await saveCampReturnForm(userId, {
                campName: campName.trim(),
                formUrl: analysis.form_url || formUrl.trim(),
                formId: analysis.form_id,
                formTitle: analysis.title || '',
                fieldMap: mapping,
                questions,
                analysisStatus: 'ready'
            });
            await loadData();
            showMessage?.('타지역 캠프 양식을 저장했습니다. 채번 화면에서 선택해 사용할 수 있습니다.');
            setAnalysis(null);
            setCampName('');
            setFormUrl('');
            setMapping(EMPTY_MAPPING);
        } catch (error) {
            console.error('[CampReturnFormManager] 양식 저장 실패:', error);
            showMessage?.(error?.message || '양식 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (form) => {
        if (!userId || !form?.id) return;
        if (!window.confirm(`${form.camp_name} 양식을 삭제할까요?`)) return;

        setDeletingId(form.id);
        try {
            await deleteCampReturnForm(userId, form.id);
            await loadData();
            showMessage?.('등록한 캠프 양식을 삭제했습니다.');
        } catch (error) {
            console.error('[CampReturnFormManager] 양식 삭제 실패:', error);
            showMessage?.(error?.message || '양식을 삭제하지 못했습니다.');
        } finally {
            setDeletingId('');
        }
    };

    const reportErrorCount = reports.filter(report => report.status === 'error').length;

    return (
        <div className="w-full max-w-3xl mx-auto pb-8">
            <div className="flex items-center gap-3 mb-4">
                <button
                    type="button"
                    onClick={onBack}
                    className={`p-2 rounded-full ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                    aria-label="뒤로가기"
                >
                    <ArrowLeft size={21} />
                </button>
                <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold">타지역 캠프 양식 관리</h2>
                    <p className={`text-xs mt-1 ${mutedClass}`}>Google Forms 링크를 등록하면 입력 항목을 분석합니다.</p>
                </div>
                <button
                    type="button"
                    onClick={loadData}
                    disabled={loading}
                    className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                    aria-label="새로고침"
                >
                    <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {!userId ? (
                <section className={`rounded-2xl border p-4 ${panelClass}`}>
                    <div className="flex items-start gap-2">
                        <AlertCircle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <h3 className="font-bold">로그인 후 이용할 수 있습니다.</h3>
                            <p className={`text-sm mt-1 leading-5 ${mutedClass}`}>
                                타지역 양식 링크는 계정에 저장되고, 양식 분석 실패 내역도 운영자에게 전달됩니다. 기존 청주 기본 채번 기능은 게스트 모드에서도 계속 사용할 수 있습니다.
                            </p>
                        </div>
                    </div>
                </section>
            ) : (
                <>
                    <section className={`rounded-2xl border p-4 mb-4 ${panelClass}`}>
                        <div className="flex items-center gap-2 mb-3">
                            <Link2 size={18} className="text-blue-500" />
                            <h3 className="font-bold">새 캠프 양식 등록</h3>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-semibold mb-1.5">캠프명</label>
                                <input
                                    value={campName}
                                    onChange={event => setCampName(event.target.value)}
                                    placeholder="예: M진천1캠프"
                                    maxLength={80}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1.5">Google Forms 링크</label>
                                <input
                                    type="url"
                                    value={formUrl}
                                    onChange={event => setFormUrl(event.target.value)}
                                    placeholder="https://docs.google.com/forms/d/e/.../viewform"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className={inputClass}
                                />
                                <p className={`text-xs mt-1 leading-5 ${mutedClass}`}>
                                    공개된 Google Forms의 보기 링크를 입력해주세요. 링크와 분석 결과는 오류 확인을 위해 운영자 접수 목록에도 저장됩니다.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleAnalyze}
                                disabled={analyzing || loading || !formUrl.trim() || !campName.trim()}
                                className="w-full rounded-xl bg-blue-600 text-white px-3 py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <ClipboardList size={16} />
                                {analyzing ? '양식 분석 중...' : '링크 분석 및 입력 항목 찾기'}
                            </button>
                        </div>
                    </section>

                    {analysis && (
                        <section className={`rounded-2xl border p-4 mb-4 ${panelClass}`}>
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="min-w-0">
                                    <h3 className="font-bold">분석 결과</h3>
                                    <p className={`text-sm mt-1 break-words ${mutedClass}`}>{analysis.title || 'Google Forms 양식'}</p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${analysis.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                                    {statusLabel(analysis.status)}
                                </span>
                            </div>
                            <p className={`text-xs mb-3 leading-5 ${mutedClass}`}>
                                자동으로 찾은 입력 항목을 확인해주세요. 비슷한 질문이 여러 개 있으면 올바른 항목을 직접 선택해야 합니다.
                            </p>

                            {[
                                ['invoice_entry_id', '운송장번호', true],
                                ['driver_id_entry_id', '기사님 아이디', true],
                                ['quantity_entry_id', '채번 수량', true],
                                ['camp_entry_id', '요청 캠프', needsCampMapping]
                            ].map(([key, label, required]) => (
                                <div key={key} className="mb-3">
                                    <label className="block text-sm font-semibold mb-1">
                                        {label}{required ? ' *' : ' (선택)'}
                                    </label>
                                    <select
                                        value={mapping[key] || ''}
                                        onChange={event => {
                                            const value = event.target.value;
                                            setMapping(current => ({
                                                ...current,
                                                [key]: value,
                                                ...(key === 'camp_entry_id' ? { camp_choice_value: '' } : {})
                                            }));
                                        }}
                                        className={inputClass}
                                    >
                                        <option value="">문항을 선택해주세요</option>
                                        {questionOptions.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}

                            {mapping.camp_entry_id && selectedCampQuestion && (
                                <div className="mb-3">
                                    <label className="block text-sm font-semibold mb-1">
                                        Google Forms에서 선택할 캠프{campChoiceOptions.length > 0 ? ' *' : ''}
                                    </label>
                                    {campChoiceOptions.length > 0 ? (
                                        <select
                                            value={mapping.camp_choice_value || ''}
                                            onChange={event => updateMapping('camp_choice_value', event.target.value)}
                                            className={inputClass}
                                        >
                                            <option value="">캠프 선택값을 선택해주세요</option>
                                            {campChoiceOptions.map((choice, index) => (
                                                <option key={`${choice}-${index}`} value={choice}>{choice}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            value={mapping.camp_choice_value || ''}
                                            onChange={event => updateMapping('camp_choice_value', event.target.value)}
                                            placeholder={campName || 'Google Forms의 선택값 입력'}
                                            className={inputClass}
                                        />
                                    )}
                                    <p className={`text-xs mt-1 leading-5 ${mutedClass}`}>
                                        문항 번호와 실제 선택값은 별도입니다. 이 값이 Google Forms의 요청 캠프에 미리 입력됩니다.
                                    </p>
                                </div>
                            )}

                            {questions.length > 0 && (
                                <div className={`rounded-xl p-3 mt-3 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                                    <p className="text-xs font-bold mb-2">발견한 전체 입력 항목 ({questions.length})</p>
                                    <div className="space-y-2">
                                        {questions.map(question => (
                                            <div key={question.entry_id} className="flex items-start justify-between gap-3 text-xs">
                                                <span className="min-w-0 break-words">{question.label}</span>
                                                <span className={`flex-shrink-0 ${mutedClass}`}>entry.{question.entry_id}{question.required ? ' · 필수' : ''}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving || !mapping.invoice_entry_id || !mapping.driver_id_entry_id || !mapping.quantity_entry_id || (needsCampMapping && (!mapping.camp_entry_id || (campChoiceOptions.length > 0 && !mapping.camp_choice_value)))}
                                className="w-full rounded-xl bg-emerald-600 text-white px-3 py-3 text-sm font-semibold disabled:opacity-50 mt-4"
                            >
                                {saving ? '저장 중...' : '이 캠프 양식 등록'}
                            </button>
                        </section>
                    )}

                    <section className={`rounded-2xl border p-4 mb-4 ${panelClass}`}>
                        <h3 className="font-bold mb-3">내가 등록한 캠프 양식 ({forms.length})</h3>
                        {loading ? (
                            <p className={`text-sm ${mutedClass}`}>양식을 불러오는 중입니다.</p>
                        ) : forms.length === 0 ? (
                            <p className={`text-sm ${mutedClass}`}>아직 등록한 타지역 양식이 없습니다.</p>
                        ) : (
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {forms.map(form => (
                                    <div key={form.id} className="py-3 flex items-start gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-sm">{form.camp_name}</p>
                                            <p className={`text-xs mt-1 break-words ${mutedClass}`}>{form.form_title || form.form_url}</p>
                                            <a
                                                href={form.form_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-500 inline-flex items-center gap-1 mt-1"
                                            >
                                                등록된 양식 열기 <ExternalLink size={12} />
                                            </a>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(form)}
                                            disabled={deletingId === form.id}
                                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                                            aria-label={form.camp_name + ' 양식 삭제'}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {loadError && (
                        <div className={`rounded-xl border p-3 mb-4 text-sm ${isDark ? 'border-red-900 bg-red-950/30 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
                            {loadError}
                        </div>
                    )}

                    {isAdmin && (
                        <section className={`rounded-2xl border p-4 ${panelClass}`}>
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <div>
                                    <h3 className="font-bold">전체 캠프 링크 접수 내역</h3>
                                    <p className={`text-xs mt-1 ${mutedClass}`}>최근 {reports.length}건 · 분석 오류 {reportErrorCount}건</p>
                                </div>
                                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">운영자</span>
                            </div>
                            {reports.length === 0 ? (
                                <p className={`text-sm ${mutedClass}`}>아직 접수된 링크가 없습니다.</p>
                            ) : (
                                <div className="space-y-3">
                                    {reports.map(report => (
                                        <div key={report.id} className={`rounded-xl border p-3 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-sm break-words">{report.camp_name || '캠프명 미입력'}</p>
                                                    <p className={`text-xs mt-1 ${mutedClass}`}>{report.user_email || '이메일 정보 없음'}</p>
                                                </div>
                                                <span className={`text-[11px] px-2 py-1 rounded-full flex-shrink-0 ${report.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : report.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                                                    {statusLabel(report.status)}
                                                </span>
                                            </div>
                                            <p className="text-xs font-medium mt-2 break-words">{report.form_title || report.form_id || '양식 제목을 읽지 못함'}</p>
                                            <a
                                                href={report.form_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-500 break-all inline-flex items-center gap-1 mt-1"
                                            >
                                                {report.form_url} <ExternalLink size={12} />
                                            </a>
                                            {report.error_message && (
                                                <p className="text-xs text-red-500 mt-2 break-words">오류: {report.error_message}</p>
                                            )}
                                            {Array.isArray(report.questions) && report.questions.length > 0 && (
                                                <details className="mt-2 text-xs">
                                                    <summary className="cursor-pointer font-semibold">분석된 입력 항목 {report.questions.length}개 보기</summary>
                                                    <div className="mt-2 space-y-1">
                                                        {report.questions.map(question => (
                                                            <p key={question.entry_id} className={mutedClass}>
                                                                {question.label} · entry.{question.entry_id}{question.required ? ' · 필수' : ''}{question.choices?.length ? ` · 선택값: ${question.choices.join(', ')}` : ''}
                                                            </p>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}
                                            <p className={`text-[11px] mt-2 ${mutedClass}`}>
                                                {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(report.created_at))}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
