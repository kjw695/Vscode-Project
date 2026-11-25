import React, { useEffect, useState } from 'react';
import { Preferences } from '@capacitor/preferences';

const AGE_VERIFIED_KEY = 'deliverymate_adult_age_verified_v1';

const getAgeFromBirthDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  // Reject impossible dates and future dates.
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayHasNotOccurred =
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day);

  if (birthdayHasNotOccurred) age -= 1;
  return age;
};

const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AdultAgeGate({ children }) {
  const [status, setStatus] = useState('loading');
  const [birthDate, setBirthDate] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadVerification = async () => {
      try {
        const { value } = await Preferences.get({ key: AGE_VERIFIED_KEY });
        if (isMounted) setStatus(value === 'true' ? 'verified' : 'required');
      } catch (error) {
        console.error('[AdultAgeGate] 연령 확인 상태를 불러오지 못했습니다:', error);
        if (isMounted) {
          setStatus('storage-error');
          setMessage('연령 확인 상태를 불러오지 못했습니다. 저장소 접근을 확인한 뒤 다시 시도해 주세요.');
        }
      }
    };

    loadVerification();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    const age = getAgeFromBirthDate(birthDate);
    if (age === null) {
      setMessage('올바른 생년월일을 입력해 주세요.');
      return;
    }

    if (age < 18) {
      setMessage('택배메이트는 만 18세 이상만 이용할 수 있습니다. 생년월일을 다시 확인해 주세요.');
      return;
    }

    try {
      // Store only the pass result. The entered date is never persisted or sent to a server.
      await Preferences.set({ key: AGE_VERIFIED_KEY, value: 'true' });
      setStatus('verified');
      setMessage('');
      setBirthDate('');
    } catch (error) {
      console.error('[AdultAgeGate] 성인 확인 결과를 저장하지 못했습니다:', error);
      setStatus('storage-error');
      setMessage('성인 확인 결과를 기기에 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  const retryStorage = async () => {
    setMessage('');
    try {
      const { value } = await Preferences.get({ key: AGE_VERIFIED_KEY });
      setStatus(value === 'true' ? 'verified' : 'required');
    } catch (error) {
      console.error('[AdultAgeGate] 저장소 재확인 실패:', error);
      setMessage('저장소에 접근할 수 없습니다. 앱을 다시 실행한 뒤에도 문제가 계속되면 문의해 주세요.');
    }
  };

  if (status === 'verified') return children;

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-gray-50 px-5 py-8 text-gray-900"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
    >
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">택배메이트 성인 이용 확인</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          택배메이트는 만 18세 이상 성인 배송기사를 위한 서비스입니다.
          이용을 계속하려면 생년월일을 입력해 주세요.
        </p>

        {status === 'storage-error' ? (
          <div className="mt-5">
            <p className="text-sm text-red-600" role="alert">{message}</p>
            <button
              type="button"
              onClick={retryStorage}
              className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white"
            >
              다시 확인
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5">
            <label htmlFor="adult-birth-date" className="block text-sm font-semibold">
              생년월일
            </label>
            <input
              id="adult-birth-date"
              type="date"
              value={birthDate}
              max={getTodayString()}
              onChange={(event) => {
                setBirthDate(event.target.value);
                setMessage('');
              }}
              required
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
            />
            <p className="mt-3 text-xs leading-5 text-gray-500">
              입력한 생년월일은 이 기기에서 성인 여부를 확인하는 데만 사용합니다.
              생년월일 자체는 서버로 전송하거나 저장하지 않으며, 확인 완료 여부만 기기에 저장합니다.
            </p>
            {message ? (
              <p className="mt-3 text-sm text-red-600" role="alert">{message}</p>
            ) : null}
            <button
              type="submit"
              disabled={!birthDate}
              className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              성인 여부 확인
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
