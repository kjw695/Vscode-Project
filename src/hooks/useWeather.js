// src/hooks/useWeather.js
import { useState, useEffect } from 'react';

// ✅ 환경 변수에서 키를 가져옵니다.
const API_KEY = process.env.REACT_APP_WEATHER_API_KEY;
const KAKAO_API_KEY = process.env.REACT_APP_KAKAO_REST_KEY;

const safeLocalStorage = {
  get: (key) => {
    try { return localStorage.getItem(key); } 
    catch (e) { return null; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, value); } 
    catch (e) { console.warn('로컬 스토리지 접근 불가'); }
  }
};

export const useWeather = () => {
  const [weatherData, setWeatherData] = useState({
    temp: null, // 🚨 null로 세팅하면 GoalProgressBar 화면에서 날씨가 완전히 숨겨집니다.
    condition: 'clear',
    region: null, 
    dust: '', 
    loading: true,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchRealTimeWeather = async (lat, lon, cachedRegionName = null) => {
      try {
        // ✨ 변경: 조건 없이 카카오 API 무조건 호출
        const apiCalls = [
          fetch(`https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${lat},${lon}&aqi=yes&lang=ko`),
          fetch(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lon}&y=${lat}`, {
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` }
          })
        ];

        const responses = await Promise.all(apiCalls);
        
        // 🚨 응답 에러 (한도 초과, API 서버 터짐 등) 시 즉시 예외 발생시켜 catch로 보냄
        if (!responses[0].ok) throw new Error(`Weather API Error: ${responses[0].status}`);
        
        const weatherDataJson = await responses[0].json();
        if (weatherDataJson.error) throw new Error(weatherDataJson.error.message);

       // ✨ 변경: 기본값을 영어 대신 "현재 위치"로 고정
        let koreanRegion = "현재 위치"; 

        // 카카오 API가 정상 응답했을 때만 동/읍/면 한글 주소 덮어쓰기
        if (responses[1] && responses[1].ok) {
          const geoData = await responses[1].json();
          const document = geoData?.documents?.[0];
          if (document) {
            koreanRegion = document.region_3depth_name || document.region_2depth_name || "현재 위치";
          }
        }

        const current = weatherDataJson?.current;
        if (!current) throw new Error('Current weather data is missing');

        const code = current?.condition?.code;
        let currentCondition = 'clear';
        const rainCodes = [1063, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246, 1273, 1276];
        const snowCodes = [1066, 1069, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264, 1279, 1282];

        if (rainCodes.includes(code)) currentCondition = 'rain';
        else if (snowCodes.includes(code)) currentCondition = 'snow';

        let pm10 = 0;
        if (current?.air_quality?.pm10) {
          pm10 = Math.round(current.air_quality.pm10);
        }

        let realDustStatus = `좋음 (${pm10})`;
        if (pm10 > 150) realDustStatus = `매우나쁨 (${pm10})`;
        else if (pm10 > 80) realDustStatus = `나쁨 (${pm10})`;
        else if (pm10 > 30) realDustStatus = `보통 (${pm10})`;

        if (currentCondition === 'clear') {
          if (pm10 > 150) currentCondition = 'dust-severe';
          else if (pm10 > 80) currentCondition = 'dust';
        }

        if (isMounted) {
          const tempC = Math.round(current?.temp_c); 
          // 온도가 정상적인 숫자일 때만 렌더링하도록 셋팅
          setWeatherData({
            temp: isNaN(tempC) ? null : tempC,
            condition: currentCondition,
            region: koreanRegion,
            dust: realDustStatus,
            loading: false,
          });
        }

        safeLocalStorage.set('lastSavedLocation', JSON.stringify({ lat, lon, regionName: koreanRegion }));

      } catch (error) {
        console.error('날씨 데이터 오류(자동 숨김 처리):', error);
        // 🚨 3. 에러 발생 시 데이터 초기화 (temp와 region을 null로 주면 UI 화면에서 아예 감춰짐!)
        if (isMounted) {
          setWeatherData({ temp: null, condition: 'clear', region: null, dust: '', loading: false });
        }
      }
    };

    const cachedLocation = safeLocalStorage.get('lastSavedLocation');

    if (cachedLocation) {
      try {
        const { lat, lon, regionName } = JSON.parse(cachedLocation);
        fetchRealTimeWeather(lat, lon, regionName);
      } catch (e) {
        console.error('캐시 데이터 파싱 오류:', e);
      }
    }

    if (!navigator.geolocation) {
      // 🚨 위치 권한이 없는 환경에서도 에러 없이 날씨 정보만 조용히 가림
      if (!cachedLocation && isMounted) {
        setWeatherData({ temp: null, condition: 'clear', region: null, dust: '', loading: false });
      }
      return () => { isMounted = false; };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
       if (cachedLocation) {
          try {
            const { lat, lon } = JSON.parse(cachedLocation);
            const distance = Math.sqrt(Math.pow(latitude - lat, 2) + Math.pow(longitude - lon, 2));
            // ✨ 변경: 거리에 상관없이(또는 캐시에 영어가 있을 수 있으니) 무조건 최신화 호출!
            fetchRealTimeWeather(latitude, longitude); 
          } catch(e) {
             fetchRealTimeWeather(latitude, longitude); 
          }
        } else {
          fetchRealTimeWeather(latitude, longitude);
        }
      },
      (error) => {
        console.error('위치 권한 없음 또는 오류:', error);
        // 🚨 유저가 '위치 허용 안함'을 눌렀을 때도 날씨 위젯을 조용히 지워버림
        if (!cachedLocation && isMounted) {
            setWeatherData({ temp: null, condition: 'clear', region: null, dust: '', loading: false });
        }
      },
      { timeout: 10000, maximumAge: 60000 } 
    );

    return () => {
      isMounted = false;
    };
  }, []);

  return weatherData;
};