import { supabase } from '../lib/supabaseClient';

export const getKoreaDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('올바르지 않은 날짜입니다.');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const getKoreaDateYearsAgo = (years, value = new Date()) => {
  const [year, month, day] = getKoreaDateKey(value).split('-').map(Number);
  const targetYear = year - Number(years);
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
};

const mapRecord = (row, signature = null) => ({
  id: row.id,
  date: row.inspection_date,
  inspectionDate: row.inspection_date,
  revision: row.revision,
  answers: row.answers || {},
  actionNotes: row.action_notes || '',
  transportCompanyName: row.transport_company_name || '',
  driverName: row.driver_name || '',
  vehicleNumber: row.vehicle_number || '',
  driverSignature: signature?.signature_data_url || '',
  signatureVersion: signature?.version || null,
  signatureVersionId: row.signature_version_id,
  correctionReason: row.correction_reason || '',
  completedAt: row.completed_at,
  updatedAt: row.updated_at,
  storageMode: 'server'
});

export const readLatestDailyInspectionSignatureFromServer = async () => {
  const { data, error } = await supabase
    .from('daily_inspection_signatures')
    .select('id, version, signature_data_url, created_at')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
};

export const saveDailyInspectionSignatureToServer = async (signatureDataUrl) => {
  const { data, error } = await supabase.rpc('save_my_daily_inspection_signature', {
    p_signature_data_url: signatureDataUrl
  });
  if (error) throw error;
  return data;
};

const attachSignatures = async (rows) => {
  if (!rows.length) return [];
  const ids = [...new Set(rows.map(row => row.signature_version_id).filter(Boolean))];
  const { data: signatures, error } = await supabase
    .from('daily_inspection_signatures')
    .select('id, version, signature_data_url')
    .in('id', ids);
  if (error) throw error;
  const byId = new Map((signatures || []).map(item => [item.id, item]));
  return rows.map(row => mapRecord(row, byId.get(row.signature_version_id)));
};

export const readDailyInspectionRecordFromServer = async (date) => {
  const { data, error } = await supabase
    .from('daily_inspection_records')
    .select('*')
    .eq('inspection_date', String(date).slice(0, 10))
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await attachSignatures([data]))[0];
};

export const listDailyInspectionRecordsFromServer = async (year, month) => {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Number(year), Number(month), 0);
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  const { data, error } = await supabase
    .from('daily_inspection_records')
    .select('*')
    .gte('inspection_date', start)
    .lte('inspection_date', end)
    .order('inspection_date', { ascending: true });
  if (error) throw error;
  return attachSignatures(data || []);
};

export const saveDailyInspectionRecordToServer = async (userId, date, record, signatureVersionId) => {
  if (!userId) throw new Error('서버 저장을 위해 로그인이 필요합니다.');
  if (!signatureVersionId) throw new Error('서명 버전을 확인하지 못했습니다. 서명을 다시 저장해주세요.');
  const payload = {
    user_id: userId,
    inspection_date: String(date).slice(0, 10),
    answers: record.answers,
    action_notes: record.actionNotes || '',
    transport_company_name: record.transportCompanyName,
    driver_name: record.driverName,
    vehicle_number: record.vehicleNumber,
    correction_reason: record.correctionReason || '',
    signature_version_id: signatureVersionId
  };
  const { data, error } = await supabase
    .from('daily_inspection_records')
    .upsert(payload, { onConflict: 'user_id,inspection_date' })
    .select('*')
    .single();
  if (error) throw error;
  return (await attachSignatures([data]))[0];
};

export const listRecentDailyInspectionRecordsFromServer = async (fromDate) => {
  const today = getKoreaDateKey();
  const { data, error } = await supabase
    .from('daily_inspection_records')
    .select('*')
    .gte('inspection_date', fromDate)
    .lte('inspection_date', today)
    .order('inspection_date', { ascending: true });
  if (error) throw error;
  return attachSignatures(data || []);
};
