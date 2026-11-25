import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, History, Link2, Trash2 } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import {
    addCampReturnRecord,
    deleteCampReturnRecord,
    findCampReturnDuplicateRecord,
    fetchAccountDriverId,
    fetchGuestDriverId,
    saveGuestDriverId,
    fetchCampReturnProfile,
    fetchCampReturnRecords,
    saveCampReturnProfile,
    fetchCampReturnForms,
    CHUNGJU_DEFAULT_FORM,
    isChungjuDefaultFormHidden
} from '../../services/campReturnNumberingService';
import CampReturnFormManager from './CampReturnFormManager';
import { getMonthlyDateRange } from '../../utils/calculator';

const FORM_URL = CHUNGJU_DEFAULT_FORM.form_url;
const CAMPS = ['학천MB', '농소MB'];
const CHUNGJU_FORM_OPTION = CHUNGJU_DEFAULT_FORM.id;

function getRegionalCampChoices(form) {
    const mapping = form?.field_map || {};
    const campQuestion = (Array.isArray(form?.questions) ? form.questions : []).find(
        question => String(question.entry_id) === String(mapping.camp_entry_id)
    );
    return Array.isArray(campQuestion?.choices)
        ? campQuestion.choices.map(choice => String(choice || '').trim()).filter(Boolean)
        : [];
}

function buildPrefilledFormUrl({ invoiceText, driverId, quantity, camp }) {
    const url = new URL(FORM_URL);
    url.searchParams.set('usp', 'pp_url');
    url.searchParams.set('entry.697011792', '채번 요청');
    url.searchParams.set('entry.359305263', invoiceText);
    url.searchParams.set('entry.1315166815', driverId);
    url.searchParams.set('entry.1437474928', String(quantity));
    url.searchParams.set('entry.362346485', camp);
    return url.toString();
}

function buildRegionalPrefilledFormUrl(form, request) {
    const url = new URL(form.form_url);
    url.searchParams.set('usp', 'pp_url');
    const mapping = form.field_map || {};
    const setEntry = (entryId, value) => {
        if (entryId && value !== undefined && value !== null && String(value) !== '') {
            url.searchParams.set(`entry.${entryId}`, String(value));
        }
    };

    setEntry(mapping.invoice_entry_id, request.invoiceText);
    setEntry(mapping.driver_id_entry_id, request.driverId);
    setEntry(mapping.quantity_entry_id, String(request.quantity));
    setEntry(mapping.camp_entry_id, request.camp || mapping.camp_choice_value || form.camp_name);

    const staticFields = Array.isArray(mapping.static_fields) ? mapping.static_fields : [];
    staticFields.forEach(field => {
        setEntry(field?.entry_id, field?.value);
    });

    // Fill conditional follow-up questions from the same app inputs:
    // second ID field <- profile driver ID; detailed camp <- selected mobile camp.
    const linkedFields = Array.isArray(mapping.linked_fields) ? mapping.linked_fields : [];
    linkedFields.forEach(field => {
        if (field?.source === 'driver_id') {
            setEntry(field.entry_id, request.driverId);
        } else if (field?.source === 'camp_choice') {
            const valueMap = field.value_map && typeof field.value_map === 'object'
                ? field.value_map
                : {};
            setEntry(field.entry_id, valueMap[String(request.camp || '')]);
        }
    });

    const questions = Array.isArray(form.questions) ? form.questions : [];
    const hasCampRelatedQuestion = questions.some(
        question => /(캠프|거점)/i.test(question.label)
    );
    const selectedCampQuestion = questions.find(
        question =>
            String(question.entry_id) === String(mapping.camp_entry_id) &&
            /(캠프|거점)/i.test(question.label) &&
            Array.isArray(question.choices) &&
            question.choices.length > 0
    );
    const campMappingIsValid = !hasCampRelatedQuestion || Boolean(selectedCampQuestion);

    const mappedIds = new Set([
        mapping.invoice_entry_id,
        mapping.driver_id_entry_id,
        mapping.quantity_entry_id,
        mapping.camp_entry_id,
        ...staticFields
            .filter(field => String(field?.value ?? '').trim())
            .map(field => String(field.entry_id)),
        ...linkedFields.map(field => String(field.entry_id))
    ].filter(Boolean).map(String));
    const unresolvedRequired = questions.filter(
        question => question.required && !mappedIds.has(String(question.entry_id))
    );
    const roleIds = [
        mapping.invoice_entry_id,
        mapping.driver_id_entry_id,
        mapping.quantity_entry_id,
        mapping.camp_entry_id
    ].filter(Boolean).map(String);

    if (!mapping.invoice_entry_id || !mapping.driver_id_entry_id || !mapping.quantity_entry_id) {
        throw new Error('운송장번호, 기사님 아이디, 채번 수량 문항 연결을 확인해주세요.');
    }
    if (new Set(roleIds).size !== roleIds.length) {
        throw new Error('운송장번호, 기사님 아이디, 수량, 캠프는 서로 다른 문항에 연결해야 합니다.');
    }
    if (!campMappingIsValid) {
        throw new Error('필수 요청 캠프 문항이 연결되지 않았습니다. 양식 관리를 확인해주세요.');
    }
    if (unresolvedRequired.length > 0) {
        throw new Error('연결되지 않은 필수 문항이 ' + unresolvedRequired.length + '개 있습니다. 양식 관리를 확인해주세요.');
    }
    return url.toString();
}
function localDateKey(value) {
    const date = new Date(value);
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

function formatTime(value) {
    return new Intl.DateTimeFormat('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(value));
}

function formatDate(value) {
    return new Intl.DateTimeFormat('ko-KR', {
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(value));
}

function parseInvoiceDetails(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const trackingNumber = text.match(/운송장\s*번호\s*[:：]?\s*([0-9]+)/i)?.[1] || '';
    const orderNumber = text.match(/주문\s*번호\s*[:：]?\s*([0-9]+)/i)?.[1] || '';

    if (!trackingNumber && !orderNumber) return null;
    return { trackingNumber, orderNumber };
}

export default function CampReturnNumberingView({ onBack, onGoToProfile, isDarkMode, user, showMessage, monthlyStartDay = 26, monthlyEndDay = 25 }) {
    const [driverId, setDriverId] = useState('');
    const [invoiceText, setInvoiceText] = useState('');
    const [quantity, setQuantity] = useState('');
    const [camp, setCamp] = useState(CAMPS[0]);
    const [selectedMobileCamp, setSelectedMobileCamp] = useState('');
    const [records, setRecords] = useState([]);
    const [showMonthlySummary, setShowMonthlySummary] = useState(false);
    const [deletingRecordId, setDeletingRecordId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingPreference, setSavingPreference] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [storageNotice, setStorageNotice] = useState('');
    const [regionalForms, setRegionalForms] = useState([]);
    const [selectedRegionalFormId, setSelectedRegionalFormId] = useState('');
    const [chungjuDefaultHidden, setChungjuDefaultHidden] = useState(false);
    const [showFormManager, setShowFormManager] = useState(false);

    const userId = user?.id || null;
    const isDark = !!isDarkMode;

    const loadData = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const [profile, history, accountDriverId, forms] = await Promise.all([
                fetchCampReturnProfile(userId),
                fetchCampReturnRecords(userId),
                fetchAccountDriverId(userId),
                fetchCampReturnForms(userId)
            ]);
            const isBuiltInChungjuHidden = isChungjuDefaultFormHidden(userId);
            setChungjuDefaultHidden(isBuiltInChungjuHidden);
            setDriverId(userId ? accountDriverId : fetchGuestDriverId());
            const availableForms = Array.isArray(forms) ? forms : [];
            const registeredChungjuForm = availableForms.find(
                form => String(form.form_id) === CHUNGJU_DEFAULT_FORM.form_id
            ) || null;
            const defaultChungjuSelection = registeredChungjuForm?.id ||
                (isBuiltInChungjuHidden ? '' : CHUNGJU_FORM_OPTION);
            const savedDefaultForm = availableForms.find(form => form.id === profile?.default_form_id) || null;
            const latestRecord = Array.isArray(history) ? history[0] : null;
            const latestFormKey = String(latestRecord?.form_key || '');
            const lastUsedRegionalForm = latestFormKey.startsWith('regional:')
                ? availableForms.find(form => form.id === latestFormKey.slice('regional:'.length)) || null
                : null;

            // Existing users keep their saved selection. A new user with no profile/history starts unselected.
            let preferredFormSelection = '';
            if (profile) {
                if (profile.default_form_id) {
                    preferredFormSelection = savedDefaultForm?.id || '';
                } else {
                    // A profile with no regional form was created by the previous Chungju flow.
                    preferredFormSelection = defaultChungjuSelection;
                }
            } else if (lastUsedRegionalForm) {
                preferredFormSelection = lastUsedRegionalForm.id;
            } else if (latestRecord && !latestFormKey.startsWith('regional:')) {
                // Restore the former built-in form for users whose profile row is missing.
                preferredFormSelection = defaultChungjuSelection;
            }

            const defaultCamp = CAMPS.includes(profile?.default_camp) ? profile.default_camp : CAMPS[0];
            const preferredRegionalForm = availableForms.find(form => form.id === preferredFormSelection) || null;
            const preferredCampChoices = getRegionalCampChoices(preferredRegionalForm);
            const latestRecordFormId = latestFormKey.startsWith('regional:')
                ? latestFormKey.slice('regional:'.length)
                : '';
            const lastRecordedMobileCamp = latestRecordFormId === preferredRegionalForm?.id
                ? String(latestRecord?.camp || '').trim()
                : '';
            const savedMobileCamp = String(profile?.default_mobile_camp || lastRecordedMobileCamp).trim();
            const configuredMobileCamp = String(preferredRegionalForm?.field_map?.camp_choice_value || '').trim();
            let preferredMobileCamp = '';

            if (preferredFormSelection === CHUNGJU_FORM_OPTION) {
                preferredMobileCamp = defaultCamp;
            } else if (preferredRegionalForm) {
                if (preferredCampChoices.length === 1) {
                    preferredMobileCamp = preferredCampChoices[0];
                } else if (preferredCampChoices.length > 1) {
                    preferredMobileCamp = preferredCampChoices.includes(savedMobileCamp)
                        ? savedMobileCamp
                        : preferredCampChoices.includes(configuredMobileCamp)
                            ? configuredMobileCamp
                            : '';
                } else {
                    preferredMobileCamp = savedMobileCamp || configuredMobileCamp || preferredRegionalForm.camp_name;
                }
            }

            setCamp(defaultCamp);
            setSelectedMobileCamp(preferredMobileCamp);
            setRegionalForms(availableForms);
            setSelectedRegionalFormId(preferredFormSelection);
            setRecords(history);

            // Restore the selection inferred from an older request history when no profile exists.
            if (!profile && preferredFormSelection) {
                saveCampReturnProfile(userId, {
                    defaultCamp,
                    defaultFormId: preferredFormSelection === CHUNGJU_FORM_OPTION ? null : preferredFormSelection,
                    defaultMobileCamp: preferredFormSelection === CHUNGJU_FORM_OPTION ? null : preferredMobileCamp
                }).catch(error => {
                    console.warn('[CampReturnNumbering] 기존 양식 선택 복원 실패:', error);
                });
            }
            setStorageNotice('채번 기록과 통계는 이 기기에만 저장됩니다. 앱 삭제 또는 앱 데이터 초기화 시 기록이 사라집니다.');
        } catch (error) {
            console.error('[CampReturnNumbering] 데이터 조회 실패:', error);
            setLoadError('채번 기록 이전 또는 Google Forms 양식 정보를 불러오지 못했습니다. 인터넷 연결과 로그인 상태를 확인해주세요.');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const todayKey = localDateKey(new Date());
    const todayRecords = useMemo(
        () => records.filter(record => record.user_confirmed_at && localDateKey(record.user_confirmed_at) === todayKey),
        [records, todayKey]
    );
    const todayQuantity = todayRecords.reduce((sum, record) => sum + (Number(record.quantity) || 0), 0);
    const campTotals = useMemo(() => {
        const totals = {};
        todayRecords.forEach(record => {
            const key = String(record.camp || '기타');
            totals[key] = (totals[key] || 0) + Number(record.quantity || 0);
        });
        return totals;
    }, [todayRecords]);
    const visibleCampSummaryNames = Object.keys(campTotals).filter(
        item => (Number(campTotals[item]) || 0) > 0
    );

    const monthlyPeriod = useMemo(() => {
        const startDay = Number(monthlyStartDay) || 26;
        const endDay = Number(monthlyEndDay) || 25;
        const now = new Date();
        let periodYear = now.getFullYear();
        let periodMonth = now.getMonth() + 1;

        // App.js uses the configured end day to decide which monthly ledger is current.
        if (now.getDate() > endDay) {
            periodMonth += 1;
            if (periodMonth > 12) {
                periodMonth = 1;
                periodYear += 1;
            }
        }

        const { startStr, endStr } = getMonthlyDateRange(
            periodYear,
            periodMonth,
            startDay,
            endDay
        );
        return { year: periodYear, month: periodMonth, startStr, endStr };
    }, [monthlyStartDay, monthlyEndDay]);

    const currentMonthRecords = useMemo(
        () => records.filter(record => {
            if (!record.user_confirmed_at) return false;
            const recordDate = localDateKey(record.user_confirmed_at);
            return recordDate >= monthlyPeriod.startStr && recordDate <= monthlyPeriod.endStr;
        }),
        [records, monthlyPeriod]
    );
    const monthlyQuantity = currentMonthRecords.reduce(
        (sum, record) => sum + (Number(record.quantity) || 0),
        0
    );
    const monthlyCampTotals = useMemo(() => {
        const totals = {};
        currentMonthRecords.forEach(record => {
            const key = String(record.camp || '기타');
            totals[key] = (totals[key] || 0) + Number(record.quantity || 0);
        });
        return totals;
    }, [currentMonthRecords]);
    const visibleMonthlyCampNames = Object.keys(monthlyCampTotals).filter(
        item => (Number(monthlyCampTotals[item]) || 0) > 0
    );
    const monthLabel = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long'
    }).format(new Date(monthlyPeriod.year, monthlyPeriod.month - 1, 1));
    const monthlyPeriodLabel = `${monthlyPeriod.startStr.slice(5).replace('-', '/')} ~ ${monthlyPeriod.endStr.slice(5).replace('-', '/')}`;

    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);
    const recentWeekStartKey = localDateKey(weekStart);
    const recentRecords = useMemo(
        () => records.filter(record => record.user_confirmed_at && localDateKey(record.user_confirmed_at) >= recentWeekStartKey),
        [records, recentWeekStartKey]
    );
    const selectedRegionalForm = regionalForms.find(form => form.id === selectedRegionalFormId) || null;
    const hasRegisteredChungjuForm = regionalForms.some(
        form => String(form.form_id) === CHUNGJU_DEFAULT_FORM.form_id
    );
    const showChungjuDefaultOption = !chungjuDefaultHidden && !hasRegisteredChungjuForm;
    const isChungjuDefault = selectedRegionalFormId === CHUNGJU_FORM_OPTION;
    const hasSelectedForm = Boolean(selectedRegionalForm || (isChungjuDefault && showChungjuDefaultOption));
    const regionalCampChoices = useMemo(
        () => getRegionalCampChoices(selectedRegionalForm),
        [selectedRegionalForm]
    );
    const mobileCampOptions = isChungjuDefault ? CAMPS : regionalCampChoices;

    const panelClass = isDark
        ? 'bg-gray-800 border-gray-700 text-gray-100'
        : 'bg-white border-gray-200 text-gray-900';
    const inputClass = `w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`;
    const mutedClass = isDark ? 'text-gray-400' : 'text-gray-500';

    const persistFormPreference = async ({
        formId = null,
        mobileCamp = null,
        defaultCamp = camp
    } = {}) => {
        setSavingPreference(true);
        try {
            await saveCampReturnProfile(userId, {
                defaultCamp,
                defaultFormId: formId,
                defaultMobileCamp: mobileCamp
            });
        } catch (error) {
            console.error('[CampReturnNumbering] 양식/요청 캠프 선택 저장 실패:', error);
            showMessage?.('선택한 양식 또는 요청 캠프를 저장하지 못했습니다. 다시 선택해주세요.');
        } finally {
            setSavingPreference(false);
        }
    };

    const handleFormSelectionChange = async nextFormId => {
        setSelectedRegionalFormId(nextFormId);

        if (!nextFormId) {
            setSelectedMobileCamp('');
            await persistFormPreference({
                formId: null,
                mobileCamp: null
            });
            return;
        }

        if (nextFormId === CHUNGJU_FORM_OPTION) {
            setSelectedMobileCamp(camp);
            await persistFormPreference({
                formId: null,
                mobileCamp: null,
                defaultCamp: camp
            });
            return;
        }

        const nextForm = regionalForms.find(form => form.id === nextFormId);
        const nextChoices = getRegionalCampChoices(nextForm);
        const configuredChoice = String(nextForm?.field_map?.camp_choice_value || '').trim();
        const nextMobileCamp = nextForm
            ? (nextChoices.length === 1
                ? nextChoices[0]
                : nextChoices.length > 1
                    ? (nextChoices.includes(configuredChoice) ? configuredChoice : '')
                    : (configuredChoice || nextForm.camp_name))
            : '';

        setSelectedMobileCamp(nextMobileCamp);
        if (nextForm) {
            await persistFormPreference({
                formId: nextForm.id,
                mobileCamp: nextMobileCamp || null
            });
        }
    };

    const handleMobileCampChange = async value => {
        if (isChungjuDefault) {
            setCamp(value);
            await persistFormPreference({
                formId: null,
                mobileCamp: null,
                defaultCamp: value
            });
            return;
        }

        if (!selectedRegionalForm) return;
        setSelectedMobileCamp(value);
        await persistFormPreference({
            formId: selectedRegionalForm.id,
            mobileCamp: value
        });
    };

    const handleOpenForm = async () => {
        const normalizedInvoice = invoiceText.replace(/[\r\n]+/g, ' ').trim();
        const normalizedDriverId = driverId.trim();
        const numericQuantity = Number(quantity);

        if (!normalizedInvoice) {
            showMessage?.('운송장번호와 주문번호가 포함된 내용을 붙여넣어주세요.');
            return;
        }
        if (!normalizedDriverId) {
            showMessage?.('기사님 아이디를 입력해주세요.');
            return;
        }
        if (!Number.isInteger(numericQuantity) || numericQuantity < 1) {
            showMessage?.('채번 수량은 1 이상의 숫자로 입력해주세요.');
            return;
        }
        if (!hasSelectedForm) {
            showMessage?.('먼저 사용할 채번 양식을 선택해주세요. 소속 캠프 양식을 등록하거나 청주 기본 양식을 선택할 수 있습니다.');
            return;
        }
        if (isChungjuDefault && !CAMPS.includes(camp)) {
            showMessage?.('요청 캠프를 선택해주세요.');
            return;
        }
        if (selectedRegionalForm && regionalCampChoices.length > 1 && !regionalCampChoices.includes(selectedMobileCamp)) {
            showMessage?.('요청 모바일 캠프를 선택해주세요.');
            return;
        }

        const invoiceDetails = parseInvoiceDetails(normalizedInvoice);
        setSaving(true);
        let savedRecord = null;
        try {
            const duplicateRecord = await findCampReturnDuplicateRecord(userId, invoiceDetails);

            if (duplicateRecord) {
                const detailLines = [
                    '이미 등록된 채번 요청입니다.',
                    invoiceDetails?.trackingNumber ? `운송장번호 ${invoiceDetails.trackingNumber}` : '',
                    invoiceDetails?.orderNumber ? `주문번호　　${invoiceDetails.orderNumber}` : '',
                    `기존 기록: ${duplicateRecord.camp} · ${formatDate(duplicateRecord.user_confirmed_at)} ${formatTime(duplicateRecord.user_confirmed_at)}`,
                    '기존 요청 기록을 확인해주세요.'
                ].filter(Boolean);
                showMessage?.(detailLines.join('\n'));
                return;
            }

            const request = {
                invoiceText: normalizedInvoice,
                driverId: normalizedDriverId,
                quantity: numericQuantity,
                camp: selectedRegionalForm
                    ? (selectedMobileCamp || selectedRegionalForm.camp_name)
                    : camp,
                formKey: selectedRegionalForm ? `regional:${selectedRegionalForm.id}` : 'chungju1_return_numbering_v1'
            };
            const url = selectedRegionalForm
                ? buildRegionalPrefilledFormUrl(selectedRegionalForm, request)
                : buildPrefilledFormUrl(request);

            // Save the request at the moment the user taps auto-fill, before opening Google Forms.
            savedRecord = await addCampReturnRecord(userId, request);
            setRecords(current => [
                savedRecord,
                ...current.filter(record => String(record.id) !== String(savedRecord.id))
            ]);

            // The request log is the priority; a preference-save failure must not lose the request.
            await saveCampReturnProfile(userId, {
                defaultCamp: camp,
                defaultFormId: selectedRegionalForm?.id || null,
                defaultMobileCamp: selectedRegionalForm
                    ? (selectedMobileCamp || selectedRegionalForm.field_map?.camp_choice_value || selectedRegionalForm.camp_name)
                    : null
            }).catch(error => {
                console.warn('[CampReturnNumbering] 요청 기록 후 기본 양식 설정 저장 실패:', error);
            });

            if (Capacitor.getPlatform() === 'web') {
                const opened = window.open(url, '_blank', 'noopener,noreferrer');
                if (!opened) throw new Error('브라우저에서 새 창을 열지 못했습니다.');
            } else {
                await Browser.open({ url });
            }
            showMessage?.('채번 요청 기록을 저장하고 설문지를 열었습니다. 설문지에서 내용을 확인한 뒤 직접 제출해주세요.');
        } catch (error) {
            console.error('[CampReturnNumbering] 설문지 열기 또는 요청 기록 저장 실패:', error);
            if (savedRecord) {
                showMessage?.(`채번 요청 기록은 저장되었습니다. 다만 설문지를 열지 못했습니다. 최근 기록에서 해당 기록을 삭제한 뒤 다시 시도해주세요.\n${error?.message || ''}`);
            } else {
                showMessage?.(error?.message || '채번 요청을 저장하거나 설문지를 여는 데 실패했습니다.');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRecord = async record => {
        if (!record?.id) return;
        const confirmed = window.confirm(
            '이 채번 기록을 삭제할까요? 삭제한 기록은 오늘 및 월간 집계에서도 제외됩니다.'
        );
        if (!confirmed) return;

        setDeletingRecordId(record.id);
        try {
            await deleteCampReturnRecord(userId, record.id);
            setRecords(current => current.filter(item => String(item.id) !== String(record.id)));
            showMessage?.('채번 기록을 삭제했습니다.');
        } catch (error) {
            console.error('[CampReturnNumbering] 채번 기록 삭제 실패:', error);
            showMessage?.(error?.message || '채번 기록을 삭제하지 못했습니다. Supabase 삭제 권한을 확인해주세요.');
        } finally {
            setDeletingRecordId(null);
        }
    };

    if (showFormManager) {
        return (
            <CampReturnFormManager
                onBack={async () => {
                    setShowFormManager(false);
                    await loadData();
                }}
                isDarkMode={isDarkMode}
                user={user}
                defaultCamp={camp}
                showMessage={showMessage}
            />
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto pb-8">
            <div className="flex items-center gap-3 mb-4">
                <button
                    type="button"
                    onClick={onBack}
                    className={`p-2 rounded-full flex-shrink-0 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                    aria-label="뒤로가기"
                >
                    <ArrowLeft size={21} />
                </button>
                <h2 className="text-lg font-bold min-w-0 flex-1 whitespace-nowrap">반품 채번 요청</h2>
                <button
                    type="button"
                    onClick={() => setShowFormManager(true)}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-black px-2.5 py-2 text-xs font-semibold whitespace-nowrap text-yellow-300 hover:bg-gray-900"
                >
                    <Link2 size={14} /> 양식 등록/관리
                </button>
            </div>

            {storageNotice && (
                <p className={`text-xs mb-3 px-1 ${mutedClass}`}>{storageNotice}</p>
            )}

            {loadError && (
                <div className={`rounded-xl border p-3 mb-4 text-sm ${isDark ? 'border-red-900 bg-red-950/30 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    <p>{loadError}</p>
                    <button type="button" onClick={loadData} className="mt-2 underline font-semibold">다시 불러오기</button>
                </div>
            )}

            <section className={`rounded-2xl border p-4 mb-4 ${panelClass}`}>
                <h3 className="font-bold mb-3">채번 요청 정보</h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-semibold mb-1.5">운송장번호</label>
                        <textarea
                            value={invoiceText}
                            onChange={event => setInvoiceText(event.target.value)}
                            rows={2}
                            placeholder="앱에서 복사한 운송장번호와 주문번호를 그대로 붙여넣으세요."
                            className={inputClass}
                        />
                        <p className={`text-xs mt-1 ${mutedClass}`}>복사한 문구를 그대로 사용합니다.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1.5">
                            {userId ? '기사님 아이디 · 내정보에서 자동 입력' : '기사님 아이디 · 직접 입력'}
                        </label>
                        {userId ? (
                            driverId ? (
                                <div className={`w-full rounded-xl border px-3 py-3 text-sm font-semibold ${isDark ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-gray-50 border-gray-300 text-gray-900'}`}>
                                    {driverId}
                                </div>
                            ) : (
                                <div className={`rounded-xl border p-3 ${isDark ? 'border-amber-800 bg-amber-950/30' : 'border-amber-200 bg-amber-50'}`}>
                                    <p className="whitespace-nowrap font-semibold leading-tight tracking-tight" style={{ fontSize: "clamp(11px, 3.6vw, 14px)" }}>기사님 아이디가 내정보에 없습니다.</p>
                                    <p className={`mt-1 whitespace-nowrap ${mutedClass}`} style={{ fontSize: "clamp(11px, 3.6vw, 14px)" }}>아이디 등록 후 채번 요청해주세요.</p>
                                    <button
                                        type="button"
                                        onClick={onGoToProfile}
                                        className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                                    >
                                        내정보에서 아이디 등록하기
                                    </button>
                                </div>
                            )
                        ) : (
                            <div>
                                <input
                                    type="text"
                                    inputMode="text"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    value={driverId}
                                    onChange={event => {
                                        const value = event.target.value;
                                        setDriverId(value);
                                        try {
                                            saveGuestDriverId(value);
                                        } catch (error) {
                                            console.warn('[CampReturnNumbering] 기사님 아이디 로컬 저장 실패:', error);
                                        }
                                    }}
                                    placeholder="기사님 아이디를 입력하세요."
                                    className={inputClass}
                                />
                                <p className={`text-xs mt-1 ${mutedClass}`}>입력한 아이디는 이 기기에 자동 저장됩니다.</p>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1.5">채번 수량</label>
                        <p className={`text-[11px] mb-1.5 ${mutedClass}`}>최초 배송 박스 수량 범위 내에서 요청해주세요.</p>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="number"
                                inputMode="numeric"
                                min="1"
                                step="1"
                                value={quantity}
                                onChange={event => setQuantity(event.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="수량 입력"
                                className={inputClass}
                            />
                            <div className="grid grid-cols-2 grid-rows-2 gap-1.5" role="group" aria-label="채번 수량 빠른 선택">
                                {[1, 2, 3, 4].map(value => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setQuantity(String(value))}
                                        aria-pressed={quantity === String(value)}
                                        className={`rounded-lg border text-sm font-semibold transition-colors ${quantity === String(value)
                                            ? 'border-blue-600 bg-blue-600 text-white'
                                            : isDark
                                                ? 'border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800'
                                                : 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                                    >
                                        {value}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1.5">사용할 채번 양식</label>
                        <select
                            value={selectedRegionalFormId}
                            onChange={event => handleFormSelectionChange(event.target.value)}
                            disabled={savingPreference}
                            className={inputClass}
                        >
                            <option value="">양식을 선택해주세요</option>
                            {showChungjuDefaultOption && (
                                <option value={CHUNGJU_FORM_OPTION}>청주 기본 양식</option>
                            )}
                            {regionalForms.map(form => (
                                <option key={form.id} value={form.id}>{form.camp_name}</option>
                            ))}
                        </select>
                        {!hasSelectedForm ? (
                            <p className={`text-xs mt-1.5 ${mutedClass}`}>
                                사용할 양식을 먼저 선택해주세요.
                            </p>
                        ) : null}
                    </div>
                    {hasSelectedForm && (isChungjuDefault || selectedRegionalForm?.field_map?.camp_entry_id) && (
                        <div>
                            <label className="block text-sm font-semibold mb-1.5">요청 모바일 캠프</label>
                            {mobileCampOptions.length > 1 ? (
                                <select
                                    value={isChungjuDefault ? camp : selectedMobileCamp}
                                    onChange={event => handleMobileCampChange(event.target.value)}
                                    disabled={savingPreference}
                                    className={inputClass}
                                >
                                    <option value="">캠프를 선택해주세요</option>
                                    {mobileCampOptions.map((item, index) => (
                                        <option key={`${item}-${index}`} value={item}>{item}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className={`w-full rounded-xl border px-3 py-3 text-sm font-semibold ${isDark ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-gray-50 border-gray-300 text-gray-900'}`}>
                                    {mobileCampOptions[0] || selectedMobileCamp || selectedRegionalForm?.camp_name || camp}
                                </div>
                            )}
                            {selectedRegionalForm?.form_title && (
                                <p className={`text-xs mt-1.5 ${mutedClass}`}>{selectedRegionalForm.form_title}</p>
                            )}
                        </div>
                    )}
                    <div className="pt-1">
                        <button
                            type="button"
                            onClick={handleOpenForm}
                            disabled={saving || loading || !driverId.trim() || !hasSelectedForm || (selectedRegionalForm && regionalCampChoices.length > 1 && !regionalCampChoices.includes(selectedMobileCamp))}
                            className="w-full rounded-xl bg-blue-600 text-white px-3 py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <ExternalLink size={16} /> 설문지 자동 입력
                        </button>
                    </div>
                </div>
                <p className={`text-xs mt-3 leading-5 ${mutedClass}`}>
                    {savingPreference ? '선택한 양식과 캠프를 저장하는 중입니다.' : storageNotice}
                </p>
            </section>

            <section className={`rounded-2xl border p-4 mb-4 ${panelClass}`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <History size={18} />
                        <h3 className="font-bold truncate">
                            {showMonthlySummary ? `${monthLabel} 채번 현황` : '오늘의 채번 현황'}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowMonthlySummary(value => !value)}
                        className={`flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold ${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`}
                    >
                        {showMonthlySummary ? '오늘' : '월간'}
                    </button>
                </div>

                {showMonthlySummary ? (
                    <>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className={`rounded-xl p-3 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                                <p className={`text-xs ${mutedClass}`}>이번 달 채번 수량</p>
                                <p className="text-2xl font-bold text-emerald-500 mt-1">{monthlyQuantity.toLocaleString()}건</p>
                            </div>
                            <div className={`rounded-xl p-3 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                                <p className={`text-xs ${mutedClass}`}>이번 달 요청 기록</p>
                                <p className="text-2xl font-bold mt-1">{currentMonthRecords.length}회</p>
                            </div>
                        </div>
                        <p className={`text-xs mb-3 ${mutedClass}`}>집계 기간: {monthlyPeriodLabel}</p>
                        {visibleMonthlyCampNames.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {visibleMonthlyCampNames.map(item => (
                                    <div key={item} className={`rounded-xl border p-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                        <p className={`text-xs ${mutedClass}`}>{item}</p>
                                        <p className="text-lg font-bold mt-1">{(monthlyCampTotals[item] || 0).toLocaleString()}건</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className={`text-sm ${mutedClass}`}>이번 달 채번 기록이 없습니다.</p>
                        )}
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className={`rounded-xl p-3 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                                <p className={`text-xs ${mutedClass}`}>오늘 채번 수량</p>
                                <p className="text-2xl font-bold text-emerald-500 mt-1">{todayQuantity.toLocaleString()}건</p>
                            </div>
                            <div className={`rounded-xl p-3 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                                <p className={`text-xs ${mutedClass}`}>오늘 요청 기록</p>
                                <p className="text-2xl font-bold mt-1">{todayRecords.length}회</p>
                            </div>
                        </div>
                        {visibleCampSummaryNames.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                                {visibleCampSummaryNames.map(item => (
                                    <div key={item} className={`rounded-xl border p-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                        <p className={`text-xs ${mutedClass}`}>{item}</p>
                                        <p className="text-lg font-bold mt-1">{(campTotals[item] || 0).toLocaleString()}건</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
                <p className={`text-[11px] mt-3 leading-4 ${mutedClass}`}>
                    설문지 자동 입력을 누른 시점에 기록됩니다. 제출하지 않았거나 잘못 입력한 기록은 최근 기록에서 삭제해주세요. 집계일은 기록 저장일 기준입니다.
                </p>
            </section>

            <section className={`rounded-2xl border p-4 ${panelClass}`}>
                <h3 className="font-bold mb-3">최근 7일 채번 기록</h3>
                {loading ? (
                    <p className={`text-sm ${mutedClass}`}>기록을 불러오는 중입니다.</p>
                ) : recentRecords.length === 0 ? (
                    <p className={`text-sm ${mutedClass}`}>최근 7일 내 채번 기록이 없습니다.</p>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {recentRecords.map(record => {
                            const invoiceDetails = parseInvoiceDetails(record.invoice_text);
                            return (
                                <div key={record.id} className="py-3 flex items-center justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold">{record.camp} · {formatDate(record.user_confirmed_at)} {formatTime(record.user_confirmed_at)}</div>
                                        {invoiceDetails ? (
                                            <div className={"grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 text-xs mt-1 " + mutedClass}>
                                                {invoiceDetails.trackingNumber && (
                                                    <>
                                                        <span>운송장번호</span>
                                                        <span className="break-all">{invoiceDetails.trackingNumber}</span>
                                                    </>
                                                )}
                                                {invoiceDetails.orderNumber && (
                                                    <>
                                                        <span>주문번호</span>
                                                        <span className="break-all">{invoiceDetails.orderNumber}</span>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <div className={"text-xs whitespace-pre-wrap break-all mt-1 " + mutedClass}>{record.invoice_text}</div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <div className="text-right">
                                            <div className="font-bold">{Number(record.quantity || 0).toLocaleString()}건</div>
                                            <div className={"text-[11px] " + mutedClass}>{record.driver_id}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteRecord(record)}
                                            disabled={deletingRecordId === record.id}
                                            aria-label="채번 기록 삭제"
                                            title="채번 기록 삭제"
                                            className={`rounded-lg p-2 disabled:opacity-40 ${isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-red-300' : 'text-gray-500 hover:bg-red-50 hover:text-red-600'}`}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
