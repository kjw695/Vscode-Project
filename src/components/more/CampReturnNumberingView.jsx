import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, ClipboardCheck, History, AlertCircle } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import {
    addCampReturnRecord,
    fetchAccountDriverId,
    fetchGuestDriverId,
    saveGuestDriverId,
    fetchCampReturnProfile,
    fetchCampReturnRecords,
    saveCampReturnProfile,
    fetchCampReturnForms
} from '../../services/campReturnNumberingService';
import CampReturnFormManager from './CampReturnFormManager';

const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd8kBLT6B5iGSTLuG5yyMCbuCJ5l1e5qYpEqbUdtbtCSwUZqg/viewform';
const CAMPS = ['학천MB', '농소MB'];

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
    setEntry(mapping.camp_entry_id, mapping.camp_choice_value || request.camp);

    (Array.isArray(mapping.static_fields) ? mapping.static_fields : []).forEach(field => {
        setEntry(field?.entry_id, field?.value);
    });

    if (!mapping.invoice_entry_id || !mapping.driver_id_entry_id || !mapping.quantity_entry_id) {
        throw new Error('캠프 양식의 필수 입력 항목 연결이 완료되지 않았습니다. 양식 설정을 확인해주세요.');
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

export default function CampReturnNumberingView({ onBack, onGoToProfile, isDarkMode, user, showMessage }) {
    const [driverId, setDriverId] = useState('');
    const [invoiceText, setInvoiceText] = useState('');
    const [quantity, setQuantity] = useState('');
    const [camp, setCamp] = useState(CAMPS[0]);
    const [records, setRecords] = useState([]);
    const [pendingRequest, setPendingRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [storageNotice, setStorageNotice] = useState('');
    const [regionalForms, setRegionalForms] = useState([]);
    const [selectedRegionalFormId, setSelectedRegionalFormId] = useState('');
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
            setDriverId(userId ? accountDriverId : fetchGuestDriverId());
            const availableForms = Array.isArray(forms) ? forms : [];
            const savedDefaultForm = availableForms.find(form => form.id === profile?.default_form_id) || null;
            const newestForm = availableForms[0] || null;
            const preferenceUpdatedAt = profile?.updated_at ? Date.parse(profile.updated_at) : 0;
            const newestFormUpdatedAt = newestForm
                ? Date.parse(newestForm.updated_at || newestForm.created_at || '')
                : 0;
            const newestFormAddedAfterPreference = Boolean(newestForm) && (
                !profile?.updated_at ||
                !Number.isFinite(preferenceUpdatedAt) ||
                (Number.isFinite(newestFormUpdatedAt) && newestFormUpdatedAt > preferenceUpdatedAt)
            );
            const latestRecord = Array.isArray(history) ? history[0] : null;
            const latestFormKey = String(latestRecord?.form_key || '');
            const lastUsedRegionalForm = latestFormKey.startsWith('regional:')
                ? availableForms.find(form => form.id === latestFormKey.slice('regional:'.length)) || null
                : null;
            const shouldUseNewestForm = Boolean(newestForm) && (
                Boolean(profile?.default_form_id) && !savedDefaultForm
                    ? true
                    : !profile?.default_form_id && newestFormAddedAfterPreference
            );
            const preferredRegionalForm = savedDefaultForm
                || (shouldUseNewestForm ? newestForm : null)
                || lastUsedRegionalForm;

            setCamp(CAMPS.includes(profile?.default_camp) ? profile.default_camp : CAMPS[0]);
            setRegionalForms(availableForms);
            setSelectedRegionalFormId(preferredRegionalForm?.id || '');
            setRecords(history);

            // Migrate older accounts: remember an already-registered or previously used regional form.
            if (userId && preferredRegionalForm && preferredRegionalForm.id !== profile?.default_form_id) {
                saveCampReturnProfile(userId, {
                    defaultCamp: CAMPS.includes(profile?.default_camp) ? profile.default_camp : CAMPS[0],
                    defaultFormId: preferredRegionalForm.id
                }).catch(error => {
                    console.warn('[CampReturnNumbering] 기본 양식 선택 자동 저장 실패:', error);
                });
            }
            setStorageNotice(userId
                ? '로그인 계정에 저장됩니다. 다른 기기에서도 본인 기록을 조회할 수 있습니다.'
                : '현재는 이 기기에만 저장됩니다. 로그인하면 계정별 동기화를 사용할 수 있습니다.');
        } catch (error) {
            console.error('[CampReturnNumbering] 데이터 조회 실패:', error);
            setLoadError('채번 기능의 데이터베이스 설정을 확인할 수 없습니다. Supabase SQL 설정을 먼저 적용했는지 확인해주세요.');
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
    const campSummaryNames = [...new Set([
        ...CAMPS,
        ...regionalForms.map(form => form.camp_name)
    ])];
    const selectedRegionalForm = regionalForms.find(form => form.id === selectedRegionalFormId) || null;

    const panelClass = isDark
        ? 'bg-gray-800 border-gray-700 text-gray-100'
        : 'bg-white border-gray-200 text-gray-900';
    const inputClass = `w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`;
    const mutedClass = isDark ? 'text-gray-400' : 'text-gray-500';

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
        if (!selectedRegionalForm && !CAMPS.includes(camp)) {
            showMessage?.('요청 캠프를 선택해주세요.');
            return;
        }

        setSaving(true);
        try {
            await saveCampReturnProfile(userId, {
                defaultCamp: camp,
                defaultFormId: selectedRegionalForm?.id || null
            });
            const request = {
                invoiceText: normalizedInvoice,
                driverId: normalizedDriverId,
                quantity: numericQuantity,
                camp: selectedRegionalForm?.camp_name || camp,
                formKey: selectedRegionalForm ? `regional:${selectedRegionalForm.id}` : 'chungju1_return_numbering_v1'
            };
            const url = selectedRegionalForm
                ? buildRegionalPrefilledFormUrl(selectedRegionalForm, request)
                : buildPrefilledFormUrl(request);
            setPendingRequest(request);

            if (Capacitor.getPlatform() === 'web') {
                const opened = window.open(url, '_blank', 'noopener,noreferrer');
                if (!opened) throw new Error('브라우저에서 새 창을 열지 못했습니다.');
            } else {
                await Browser.open({ url });
            }
            showMessage?.('채번 요청 양식을 열었습니다. 첫 화면에서 [다음]을 눌러 입력 내용을 확인해주세요.');
        } catch (error) {
            console.error('[CampReturnNumbering] 설문지 열기 실패:', error);
            showMessage?.(error?.message || '설문지를 열지 못했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleConfirmSubmitted = async () => {
        if (!pendingRequest) return;
        setSaving(true);
        try {
            await addCampReturnRecord(userId, pendingRequest);
            setPendingRequest(null);
            await loadData();
            showMessage?.('제출 완료 확인 기록을 저장했습니다. 실제 업체 접수 여부가 확인된 것은 아닙니다.');
        } catch (error) {
            console.error('[CampReturnNumbering] 기록 저장 실패:', error);
            showMessage?.('채번 기록을 저장하지 못했습니다. 다시 시도해주세요.');
        } finally {
            setSaving(false);
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
                    className={`p-2 rounded-full ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                    aria-label="뒤로가기"
                >
                    <ArrowLeft size={21} />
                </button>
                <div className="min-w-0">
                    <h2 className="text-xl font-bold">반품 채번 요청</h2>
                </div>
            </div>

            <div className={`rounded-xl border p-3 mb-4 ${panelClass}`}>
                <div className="flex items-start gap-2">
                    <AlertCircle size={17} className="mt-0.5 flex-shrink-0 text-blue-500" />
                    <div className="text-xs leading-5">
                        최초 배송 박스 수를 초과해 반품 송장이 발급될 수 없습니다. 회수 박스 수량을 확인한 뒤 요청해주세요.
                    </div>
                </div>
            </div>

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
                            onChange={event => setSelectedRegionalFormId(event.target.value)}
                            className={inputClass}
                        >
                            <option value="">청주 기본 양식</option>
                            {regionalForms.map(form => (
                                <option key={form.id} value={form.id}>{form.camp_name}</option>
                            ))}
                        </select>
                    </div>
                    {!selectedRegionalForm ? (
                        <div>
                            <label className="block text-sm font-semibold mb-1.5">요청 모바일 캠프</label>
                            <select value={camp} onChange={event => setCamp(event.target.value)} className={inputClass}>
                                {CAMPS.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                        </div>
                    ) : (
                        <div className={`rounded-xl border p-3 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                            <p className="text-sm font-semibold">{selectedRegionalForm.camp_name}</p>
                            <p className={`text-xs mt-1 ${mutedClass}`}>{selectedRegionalForm.form_title || '등록된 지역 Google Forms 양식'}</p>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowFormManager(true)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-sm font-semibold ${isDark ? 'border-gray-700 text-gray-200 hover:bg-gray-900' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                        타지역 캠프 양식 등록 / 관리
                    </button>
                    <div className="pt-1">
                        <button
                            type="button"
                            onClick={handleOpenForm}
                            disabled={saving || loading || !driverId.trim()}
                            className="w-full rounded-xl bg-blue-600 text-white px-3 py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <ExternalLink size={16} /> 설문지 자동 입력
                        </button>
                    </div>
                </div>
                <p className={`text-xs mt-3 leading-5 ${mutedClass}`}>{storageNotice}</p>
            </section>

            {pendingRequest && (
                <section className={`rounded-2xl border p-4 mb-4 ${panelClass}`}>
                    <h3 className="font-bold mb-1">설문지 제출 확인</h3>
                    <p className={`text-xs leading-5 mb-3 ${mutedClass}`}>
                        Google 설문지에서 첫 화면의 [다음]을 누르고, 입력 내용을 확인한 뒤 직접 제출해주세요. 앱은 외부 설문지의 실제 제출 여부를 확인할 수 없습니다.
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setPendingRequest(null)}
                            disabled={saving}
                            className={`flex-1 rounded-xl border px-3 py-3 text-sm font-semibold ${isDark ? 'border-gray-600' : 'border-gray-300'}`}
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmSubmitted}
                            disabled={saving}
                            className="flex-[1.5] rounded-xl bg-emerald-600 text-white px-3 py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <ClipboardCheck size={16} /> 제출했다고 기록
                        </button>
                    </div>
                </section>
            )}

            <section className={`rounded-2xl border p-4 mb-4 ${panelClass}`}>
                <div className="flex items-center gap-2 mb-3">
                    <History size={18} />
                    <h3 className="font-bold">오늘의 채번 현황</h3>
                </div>
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
                <div className="grid grid-cols-2 gap-2">
                    {campSummaryNames.map(item => (
                        <div key={item} className={`rounded-xl border p-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            <p className={`text-xs ${mutedClass}`}>{item}</p>
                            <p className="text-lg font-bold mt-1">{(campTotals[item] || 0).toLocaleString()}건</p>
                        </div>
                    ))}
                </div>
                <p className={`text-[11px] mt-3 leading-4 ${mutedClass}`}>
                    제출 완료로 직접 표시한 기록만 합산합니다. 업체의 실제 접수·발급 결과를 조회한 수치는 아닙니다.
                </p>
            </section>

            <section className={`rounded-2xl border p-4 ${panelClass}`}>
                <h3 className="font-bold mb-3">최근 채번 기록</h3>
                {loading ? (
                    <p className={`text-sm ${mutedClass}`}>기록을 불러오는 중입니다.</p>
                ) : records.length === 0 ? (
                    <p className={`text-sm ${mutedClass}`}>아직 기록이 없습니다.</p>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {records.slice(0, 30).map(record => (
                            <div key={record.id} className="py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold">{record.camp} · {formatDate(record.user_confirmed_at)} {formatTime(record.user_confirmed_at)}</div>
                                    <div className={`text-xs truncate mt-1 ${mutedClass}`}>{record.invoice_text}</div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className="font-bold">{Number(record.quantity || 0).toLocaleString()}건</div>
                                    <div className={`text-[11px] ${mutedClass}`}>{record.driver_id}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
