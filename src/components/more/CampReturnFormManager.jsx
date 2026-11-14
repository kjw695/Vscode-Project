import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    ChevronDown,
    ChevronUp,
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
    saveCampReturnProfile,
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

function normalizeCampText(value) {
    return String(value || '')
        .toLocaleLowerCase()
        .replace(/\s+/g, '')
        .replace(/[()（）]/g, '');
}

function createSuggestedMapping(result, campName) {
    const suggested = {
        ...EMPTY_MAPPING,
        ...(result?.suggested_mapping || {})
    };
    const questions = Array.isArray(result?.questions) ? result.questions : [];
    const campQuestion = questions.find(
        question => String(question.entry_id) === String(suggested.camp_entry_id)
    );
    const choices = Array.isArray(campQuestion?.choices) ? campQuestion.choices.filter(Boolean) : [];
    const normalizedCamp = normalizeCampText(campName);
    const exactMatches = choices.filter(choice => normalizeCampText(choice) === normalizedCamp);
    const partialMatches = choices.filter(choice => {
        const choiceValue = normalizeCampText(choice);
        return normalizedCamp && (
            choiceValue.includes(normalizedCamp) ||
            normalizedCamp.includes(choiceValue)
        );
    });

    suggested.camp_choice_value = exactMatches.length === 1
        ? exactMatches[0]
        : partialMatches.length === 1
            ? partialMatches[0]
            : choices.length === 1
                ? choices[0]
                : suggested.camp_choice_value || '';

    return suggested;
}

function getMappedEntryIds(fieldMap = {}) {
    const staticIds = (Array.isArray(fieldMap.static_fields) ? fieldMap.static_fields : [])
        .filter(field => String(field?.value ?? '').trim())
        .map(field => String(field.entry_id));

    return new Set([
        fieldMap.invoice_entry_id,
        fieldMap.driver_id_entry_id,
        fieldMap.quantity_entry_id,
        fieldMap.camp_entry_id,
        ...staticIds
    ].filter(Boolean).map(String));
}

function getUnmappedRequiredQuestions(questions, fieldMap) {
    const mappedIds = getMappedEntryIds(fieldMap);
    return (Array.isArray(questions) ? questions : []).filter(
        question => question.required && !mappedIds.has(String(question.entry_id))
    );
}

function getAutoRegistrationBlockers(result, campName, fieldMap = EMPTY_MAPPING) {
    const blockers = [];
    const questions = Array.isArray(result?.questions) ? result.questions : [];

    if (!String(campName || '').trim()) blockers.push('캠프명 확인');
    if (!fieldMap.invoice_entry_id) blockers.push('운송장번호 문항');
    if (!fieldMap.driver_id_entry_id) blockers.push('기사님 아이디 문항');
    if (!fieldMap.quantity_entry_id) blockers.push('채번 수량 문항');

    const isCampQuestion = question => /(요청\s*캠프|캠프|거점)/i.test(question.label);
    const requiredCampQuestions = questions.filter(
        question => question.required && isCampQuestion(question)
    );
    const campMappingIsValid = requiredCampQuestions.length === 0 ||
        requiredCampQuestions.some(
            question => String(question.entry_id) === String(fieldMap.camp_entry_id)
        );
    if (!campMappingIsValid) blockers.push('필수 요청 캠프 문항');

    const roleIds = [
        fieldMap.invoice_entry_id,
        fieldMap.driver_id_entry_id,
        fieldMap.quantity_entry_id,
        fieldMap.camp_entry_id
    ].filter(Boolean).map(String);
    if (new Set(roleIds).size !== roleIds.length) {
        blockers.push('서로 다른 문항으로 연결');
    }

    const unresolvedRequired = getUnmappedRequiredQuestions(questions, fieldMap);
    if (unresolvedRequired.length > 0) {
        blockers.push('추가 필수 문항 ' + unresolvedRequired.length + '개');
    }

    return Array.from(new Set(blockers));
}

function getMappedQuestionLabel(form, entryId) {
    if (!entryId) return '';
    const question = (Array.isArray(form.questions) ? form.questions : []).find(
        item => String(item.entry_id) === String(entryId)
    );
    return question?.label || '연결된 문항';
}

export default function CampReturnFormManager({ onBack, isDarkMode, user, showMessage, defaultCamp = '학천MB' }) {
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
    const [expandedFormId, setExpandedFormId] = useState('');
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
    const needsCampMapping = questions.some(
        question => question.required && /(요청\s*캠프|캠프|거점)/i.test(question.label)
    );
    const unmappedRequiredQuestions = getUnmappedRequiredQuestions(questions, mapping);
    const registrationBlockers = analysis
        ? getAutoRegistrationBlockers(analysis, campName, mapping)
        : [];
    const questionOptions = useMemo(
        () => questions.map((question, index) => ({
            value: String(question.entry_id),
            label: question.label && question.label !== '질문명 없음'
                ? question.label
                : `질문명 없음 · entry.${question.entry_id}`
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
        setMapping(current => {
            const next = { ...current, [key]: value || '' };
            if (key === 'camp_entry_id') next.camp_choice_value = '';

            const reservedIds = new Set([
                next.invoice_entry_id,
                next.driver_id_entry_id,
                next.quantity_entry_id,
                next.camp_entry_id
            ].filter(Boolean).map(String));
            next.static_fields = (Array.isArray(current.static_fields) ? current.static_fields : [])
                .filter(field => !reservedIds.has(String(field.entry_id)));
            return next;
        });
    };

    const updateStaticField = (entryId, value) => {
        setMapping(current => {
            const fields = Array.isArray(current.static_fields) ? [...current.static_fields] : [];
            const index = fields.findIndex(field => String(field.entry_id) === String(entryId));
            const nextField = { entry_id: String(entryId), value: String(value ?? '') };
            if (index >= 0) fields[index] = nextField;
            else fields.push(nextField);
            return { ...current, static_fields: fields };
        });
    };

    const persistAsDefaultForm = async savedForm => {
        try {
            await saveCampReturnProfile(userId, {
                defaultCamp,
                defaultFormId: savedForm?.id || null,
                defaultMobileCamp: savedForm?.field_map?.camp_choice_value || null
            });
            return true;
        } catch (error) {
            console.error('[CampReturnFormManager] 기본 양식 선택 저장 실패:', error);
            return false;
        }
    };

    const handleAnalyze = async () => {
        if (!userId) {
            showMessage?.('타지역 양식 등록은 로그인 후 이용할 수 있습니다.');
            return;
        }
        if (!formUrl.trim()) {
            showMessage?.('Google Forms 링크를 입력해주세요.');
            return;
        }

        setAnalyzing(true);
        setAnalysis(null);
        setCampName('');
        setMapping(EMPTY_MAPPING);
        try {
            const result = await analyzeCampReturnForm(formUrl.trim());
            const detectedCampName = result.suggested_camp_name || '';
            const suggestedMapping = createSuggestedMapping(result, detectedCampName);
            const blockers = getAutoRegistrationBlockers(result, detectedCampName, suggestedMapping);

            setAnalysis(result);
            setCampName(detectedCampName);
            setFormUrl(result.form_url || formUrl.trim());
            setMapping(suggestedMapping);

            if (blockers.length === 0 && result.status === 'ready') {
                const savedForm = await saveCampReturnForm(userId, {
                    campName: detectedCampName,
                    formUrl: result.form_url || formUrl.trim(),
                    formId: result.form_id,
                    formTitle: result.title || '',
                    fieldMap: suggestedMapping,
                    questions: result.questions,
                    analysisStatus: 'ready'
                });
                const defaultSaved = await persistAsDefaultForm(savedForm);

                setAnalysis(null);
                setCampName('');
                setFormUrl('');
                setMapping(EMPTY_MAPPING);
                setExpandedFormId('');
                await loadData();
                showMessage?.(defaultSaved
                    ? `${detectedCampName} 양식이 등록되고 기본 선택 양식으로 설정되었습니다.`
                    : `${detectedCampName} 양식은 등록됐지만 기본 선택 저장은 실패했습니다. 채번 화면에서 다시 선택해주세요.`);
            } else {
                await loadData();
                showMessage?.(`자동 등록 전 확인이 필요한 항목이 있습니다: ${blockers.join(', ') || '문항 연결 확인'}`);
            }
        } catch (error) {
            console.error('[CampReturnFormManager] 양식 분석/등록 실패:', error);
            showMessage?.(error?.message || '양식 분석 또는 자동 등록에 실패했습니다. 오류 내역은 운영자 접수 목록에 기록됩니다.');
            await loadData();
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSave = async () => {
        if (!userId || !analysis) return;
        if (!campName.trim()) {
            showMessage?.('양식에서 캠프명을 자동으로 찾지 못했습니다. 캠프명을 입력해주세요.');
            return;
        }
        const blockers = getAutoRegistrationBlockers(analysis, campName, mapping);
        if (blockers.length > 0) {
            showMessage?.('필수 항목 연결을 확인해주세요: ' + blockers.join(', '));
            return;
        }

        setSaving(true);
        try {
            const savedForm = await saveCampReturnForm(userId, {
                campName: campName.trim(),
                formUrl: analysis.form_url || formUrl.trim(),
                formId: analysis.form_id,
                formTitle: analysis.title || '',
                fieldMap: mapping,
                questions,
                analysisStatus: 'ready'
            });
            const defaultSaved = await persistAsDefaultForm(savedForm);
            await loadData();
            showMessage?.(defaultSaved
                ? '타지역 캠프 양식을 저장하고 기본 선택 양식으로 설정했습니다.'
                : '양식은 저장됐지만 기본 선택 저장은 실패했습니다. 채번 화면에서 다시 선택해주세요.');
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
                            <h3 className="font-bold">Google Forms 링크 등록</h3>
                        </div>
                        <div className="space-y-3">
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
                                    링크를 입력하면 캠프명과 자동 입력 항목을 찾아 등록합니다.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleAnalyze}
                                disabled={analyzing || loading || !formUrl.trim()}
                                className="w-full rounded-xl bg-blue-600 text-white px-3 py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <ClipboardList size={16} />
                                {analyzing ? '양식 확인 및 등록 중...' : '캠프 양식 자동 등록'}
                            </button>
                        </div>
                    </section>

                    {analysis && (
                        <section className={`rounded-2xl border p-4 mb-4 ${panelClass}`}>
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="min-w-0">
                                    <h3 className="font-bold">자동 등록 전 확인</h3>
                                    <p className={`text-sm mt-1 break-words ${mutedClass}`}>{analysis.title || 'Google Forms 양식'}</p>
                                    {analysis.camp_name_source !== 'none' && campName ? (
                                        <div className={`mt-2 rounded-lg px-3 py-2 ${isDark ? 'bg-gray-900' : 'bg-blue-50'}`}>
                                            <p className={`text-xs ${mutedClass}`}>링크에서 자동 추출한 캠프명</p>
                                            <p className="text-sm font-bold mt-0.5">{campName}</p>
                                            <p className={`text-[11px] mt-0.5 ${mutedClass}`}>
                                                {analysis.camp_name_source === 'choice' ? '요청 캠프 선택지에서 확인' : 'Google Forms 제목에서 확인'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="mt-3">
                                            <label className="block text-sm font-semibold mb-1.5">캠프명 확인이 필요합니다</label>
                                            <input
                                                value={campName}
                                                onChange={event => setCampName(event.target.value)}
                                                placeholder="예: M진천1캠프"
                                                maxLength={80}
                                                className={inputClass}
                                            />
                                            <p className={`text-xs mt-1 ${mutedClass}`}>양식 제목이나 선택지에서 캠프명을 찾지 못해 한 번만 직접 입력해야 합니다.</p>
                                        </div>
                                    )}
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${analysis.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                                    {statusLabel(analysis.status)}
                                </span>
                            </div>
                            <p className={`text-xs mb-3 leading-5 ${mutedClass}`}>
                                자동으로 확인하지 못한 항목만 표시됩니다. 아래 항목을 확인하면 등록할 수 있습니다.
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
                                            updateMapping(key, value);
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
                                        기본 요청 캠프 (선택)
                                    </label>
                                    {campChoiceOptions.length > 0 ? (
                                        <select
                                            value={mapping.camp_choice_value || ''}
                                            onChange={event => updateMapping('camp_choice_value', event.target.value)}
                                            className={inputClass}
                                        >
                                            <option value="">요청 화면에서 선택</option>
                                            {campChoiceOptions.map((choice, index) => (
                                                <option key={`${choice}-${index}`} value={choice}>{choice}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            value={mapping.camp_choice_value || ''}
                                            onChange={event => updateMapping('camp_choice_value', event.target.value)}
                                            placeholder={campName || '요청할 캠프 입력'}
                                            className={inputClass}
                                        />
                                    )}
                                    <p className={`text-xs mt-1 leading-5 ${mutedClass}`}>
                                        기본값을 정할 수 있습니다. 선택하지 않으면 채번 요청 화면에서 캠프를 고릅니다.
                                    </p>
                                </div>
                            )}

                            {unmappedRequiredQuestions.length > 0 && (
                                <div className={isDark
                                    ? 'mb-3 rounded-xl border p-3 border-amber-800 bg-amber-950/20'
                                    : 'mb-3 rounded-xl border p-3 border-amber-200 bg-amber-50'}>
                                    <p className="text-sm font-semibold">추가 필수 문항 연결</p>
                                    <p className={'text-xs mt-1 mb-3 leading-5 ' + mutedClass}>
                                        Google Forms에서 필수로 지정된 나머지 문항입니다. 각 문항에 전달할 값을 지정해야 등록할 수 있습니다.
                                    </p>
                                    <div className="space-y-3">
                                        {unmappedRequiredQuestions.map(question => {
                                            const savedField = (Array.isArray(mapping.static_fields) ? mapping.static_fields : [])
                                                .find(field => String(field.entry_id) === String(question.entry_id));
                                            const value = String(savedField?.value || '');
                                            const choices = Array.isArray(question.choices) ? question.choices.filter(Boolean) : [];
                                            return (
                                                <div key={question.entry_id}>
                                                    <label className="block text-sm font-semibold mb-1">{question.label}</label>
                                                    {choices.length > 0 ? (
                                                        <select
                                                            value={value}
                                                            onChange={event => updateStaticField(question.entry_id, event.target.value)}
                                                            className={inputClass}
                                                        >
                                                            <option value="">전달할 선택값 지정</option>
                                                            {choices.map((choice, index) => (
                                                                <option key={String(question.entry_id) + '-' + index} value={choice}>{choice}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            value={value}
                                                            onChange={event => updateStaticField(question.entry_id, event.target.value)}
                                                            placeholder="이 문항에 입력할 값"
                                                            className={inputClass}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {registrationBlockers.length > 0 && (
                                <p className={'text-xs leading-5 ' + mutedClass}>
                                    등록 전 확인: {registrationBlockers.join(' · ')}
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving || registrationBlockers.length > 0}
                                className="w-full rounded-xl bg-emerald-600 text-white px-3 py-3 text-sm font-semibold disabled:opacity-50 mt-4"
                            >
                                {saving ? '저장 중...' : '이 캠프 양식 등록'}
                            </button>
                        </section>
                    )}

                    <section className={`rounded-2xl border p-4 mb-4 ${panelClass}`}>
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <h3 className="font-bold">등록된 캠프 ({forms.length})</h3>
                            <span className={`text-xs ${mutedClass}`}>캠프를 누르면 상세 정보가 열립니다.</span>
                        </div>
                        {loading ? (
                            <p className={`text-sm ${mutedClass}`}>등록된 캠프를 불러오는 중입니다.</p>
                        ) : forms.length === 0 ? (
                            <p className={`text-sm ${mutedClass}`}>아직 등록한 캠프가 없습니다. Google Forms 링크를 입력하면 자동 등록됩니다.</p>
                        ) : (
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {forms.map(form => {
                                    const isExpanded = expandedFormId === form.id;
                                    const mappedItems = [
                                        ['운송장번호', form.field_map?.invoice_entry_id],
                                        ['기사님 아이디', form.field_map?.driver_id_entry_id],
                                        ['채번 수량', form.field_map?.quantity_entry_id],
                                        ['요청 캠프', form.field_map?.camp_entry_id],
                                        ...(Array.isArray(form.field_map?.static_fields)
                                            ? form.field_map.static_fields.map(field => [
                                                getMappedQuestionLabel(form, field.entry_id),
                                                field.entry_id
                                            ])
                                            : [])
                                    ].filter(([, entryId]) => Boolean(entryId));

                                    return (
                                        <div key={form.id} className="py-2">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedFormId(isExpanded ? '' : form.id)}
                                                    className="min-w-0 flex-1 flex items-center justify-between gap-3 rounded-lg py-2 text-left"
                                                    aria-expanded={isExpanded}
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block text-sm font-semibold">{form.camp_name}</span>
                                                        <span className={`block text-xs mt-0.5 truncate ${mutedClass}`}>
                                                            {form.form_title || '등록된 Google Forms 양식'}
                                                        </span>
                                                    </span>
                                                    {isExpanded ? <ChevronUp size={17} className={mutedClass} /> : <ChevronDown size={17} className={mutedClass} />}
                                                </button>
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

                                            {isExpanded && (
                                                <div className={`mt-2 rounded-xl p-3 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                                                    <p className={`text-xs font-semibold mb-2 ${mutedClass}`}>자동 입력 연결 정보</p>
                                                    <div className="space-y-1.5">
                                                        {mappedItems.map(([label, entryId]) => (
                                                            <div key={label} className="flex justify-between gap-3 text-xs">
                                                                <span className={mutedClass}>{label}</span>
                                                                <span className="font-medium text-right">{getMappedQuestionLabel(form, entryId)}</span>
                                                            </div>
                                                        ))}
                                                        {form.field_map?.camp_choice_value && (
                                                            <div className="flex justify-between gap-3 text-xs">
                                                                <span className={mutedClass}>전달할 캠프 선택값</span>
                                                                <span className="font-medium text-right">{form.field_map.camp_choice_value}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <a
                                                        href={form.form_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-3 text-xs text-blue-500 inline-flex items-center gap-1"
                                                    >
                                                        원본 Google Forms 열기 <ExternalLink size={12} />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

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
