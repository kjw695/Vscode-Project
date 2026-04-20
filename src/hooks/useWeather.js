import { useState, useEffect, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';

const CACHE_KEY = 'kma_weather_cache';

// 🧮 기상청 격자 변환 공식
const dfs_xy_conv = (v1, v2) => {
    const RE = 6371.00877; const GRID = 5.0; const SLAT1 = 30.0; const SLAT2 = 60.0;
    const OLON = 126.0; const OLAT = 38.0; const XO = 43; const YO = 136;
    const DEGRAD = Math.PI / 180.0; const re = RE / GRID;
    const slat1 = SLAT1 * DEGRAD; const slat2 = SLAT2 * DEGRAD;
    const olon = OLON * DEGRAD; const olat = OLAT * DEGRAD;

    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = re * sf / Math.pow(ro, sn);
    let ra = Math.tan(Math.PI * 0.25 + (v1) * DEGRAD * 0.5);
    ra = re * sf / Math.pow(ra, sn);
    let theta = v2 * DEGRAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;

    return {
        x: Math.floor(ra * Math.sin(theta) + XO + 0.5),
        y: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)
    };
};

// 🕒 [실황용] 현재 시간 계산 (기존과 동일)
const getKmaBaseTime = () => {
    const now = new Date();
    let year = now.getFullYear(); let month = now.getMonth() + 1; let day = now.getDate();
    let hours = now.getHours(); let minutes = now.getMinutes();

    if (minutes < 40) {
        hours -= 1;
        if (hours < 0) {
            hours = 23;
            const prevDay = new Date(now.setDate(now.getDate() - 1));
            year = prevDay.getFullYear(); month = prevDay.getMonth() + 1; day = prevDay.getDate();
        }
    }
    return {
        baseDate: `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`,
        baseTime: `${String(hours).padStart(2, '0')}00`
    };
};

// 🕒 [예보용] 단기예보 시간 계산 (기존과 동일)
const getVilageFcstBaseTime = () => {
    const now = new Date();
    let year = now.getFullYear(); let month = now.getMonth() + 1; let day = now.getDate();
    let hours = now.getHours(); let minutes = now.getMinutes();

    if (hours < 2 || (hours === 2 && minutes < 10)) {
        const prevDay = new Date(now.setDate(now.getDate() - 1));
        year = prevDay.getFullYear(); month = prevDay.getMonth() + 1; day = prevDay.getDate();
        hours = 23;
    } else if (hours < 5 || (hours === 5 && minutes < 10)) hours = 2;
    else if (hours < 8 || (hours === 8 && minutes < 10)) hours = 5;
    else if (hours < 11 || (hours === 11 && minutes < 10)) hours = 8;
    else if (hours < 14 || (hours === 14 && minutes < 10)) hours = 11;
    else if (hours < 17 || (hours === 17 && minutes < 10)) hours = 14;
    else if (hours < 20 || (hours === 20 && minutes < 10)) hours = 17;
    else if (hours < 23 || (hours === 23 && minutes < 10)) hours = 20;
    else hours = 23;

    return {
        baseDate: `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`,
        baseTime: `${String(hours).padStart(2, '0')}00`
    };
};

export const useWeather = () => {
    const [weatherData, setWeatherData] = useState(null);
    const [locationName, setLocationName] = useState('위치 찾는 중...');
    const [isLoading, setIsLoading] = useState(true);

    const fetchWeatherAndLocation = useCallback(async () => {
        // 🚀 [최적화 1] 시작하자마자 캐시부터 뒤져서 0.1초 만에 화면에 띄우기!
        const cachedDataStr = localStorage.getItem(CACHE_KEY);
        let hasValidCache = false;

        if (cachedDataStr) {
            try {
                const cached = JSON.parse(cachedDataStr);
                if (cached.weather && cached.locationName) {
                    setWeatherData(cached.weather);
                    setLocationName(cached.locationName); // [최적화 3] 저장해둔 동네 이름도 즉시 표시
                    setIsLoading(false); // 화면이 채워졌으니 로딩 스피너 즉시 끔
                    hasValidCache = true;
                }
            } catch (e) {
                console.warn('캐시 파싱 오류');
            }
        }

        try {
            const { baseDate: ncstDate, baseTime: ncstTime } = getKmaBaseTime();

            // 🚀 [최적화 2] GPS 속도 튜닝: 정밀도 끄고, 기존 위치 10분간 재사용
            const coordinates = await Geolocation.getCurrentPosition({ 
                enableHighAccuracy: false, 
                timeout: 5000, 
                maximumAge: 1000 * 60 * 10 
            });
            const lat = coordinates.coords.latitude;
            const lon = coordinates.coords.longitude;
            
            const grid = dfs_xy_conv(lat, lon);

            // 캐시가 있고, 시간/위치가 바뀌지 않았다면 백그라운드 업데이트도 멈춤 (완전 절약)
            if (hasValidCache) {
                const cached = JSON.parse(cachedDataStr);
                if (cached.ncstDate === ncstDate && cached.ncstTime === ncstTime &&
                    cached.gridX === grid.x && cached.gridY === grid.y) {
                    console.log("✅ 최신 캐시 확인 완료! 트래픽 0건 소모");
                    return; 
                }
            }

            // 동네 이름 새로 가져오기
            let currentDongName = '현재 위치';
            if (window.nativegeocoder) {
                try {
                    const result = await new Promise((resolve, reject) => {
                        window.nativegeocoder.reverseGeocode(
                            (res) => resolve(res), (err) => reject(err), lat, lon, { useLocale: true, maxResults: 1 }
                        );
                    });
                    const addr = result[0];
                    currentDongName = addr.thoroughfare || addr.subLocality || addr.locality || '현재 위치';
                } catch (e) {
                    console.warn('Native Geocoder 실패');
                }
            }
            setLocationName(currentDongName);

            // 🚀 [최적화 4] 보안을 위해 환경변수에서 키 가져오기
            const API_KEY = process.env.REACT_APP_KMA_API_KEY; 
            const { baseDate: fcstDate, baseTime: fcstTime } = getVilageFcstBaseTime();

            const ncstUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${encodeURIComponent(API_KEY)}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${ncstDate}&base_time=${ncstTime}&nx=${grid.x}&ny=${grid.y}`;
            const fcstUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${encodeURIComponent(API_KEY)}&pageNo=1&numOfRows=150&dataType=JSON&base_date=${fcstDate}&base_time=${fcstTime}&nx=${grid.x}&ny=${grid.y}`;
            
            console.log("☁️ 기상청 서버에 새로운 날씨 요청 중...");
            const [ncstRes, fcstRes] = await Promise.all([fetch(ncstUrl), fetch(fcstUrl)]);
            const ncstData = await ncstRes.json();
            const fcstData = await fcstRes.json();

            // 실황 데이터 파싱
            const ncstItems = ncstData.response?.body?.items?.item || [];
            let temperature = '-'; let rainType = '0'; 
            ncstItems.forEach(item => {
                if (item.category === 'T1H') temperature = item.obsrValue;
                if (item.category === 'PTY') rainType = item.obsrValue;
            });

            // 예보 데이터 파싱
            const fcstItems = fcstData.response?.body?.items?.item || [];
            const now = new Date();
            const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            
            let willRainLater = false; let maxRainProb = 0;
            fcstItems.forEach(item => {
                if (item.fcstDate === todayStr) {
                    if (item.category === 'PTY' && item.fcstValue !== '0') willRainLater = true;
                    if (item.category === 'POP') maxRainProb = Math.max(maxRainProb, Number(item.fcstValue));
                }
            });

            // 날씨 분류
            let weatherCondition = '맑음'; let weatherIcon = '☀️';
            if (rainType === '1' || rainType === '5') { weatherCondition = '비'; weatherIcon = '🌧️'; }
            else if (rainType === '2' || rainType === '6') { weatherCondition = '비/눈'; weatherIcon = '🌨️'; }
            else if (rainType === '3' || rainType === '7') { weatherCondition = '눈'; weatherIcon = '❄️'; }
            else if (willRainLater || maxRainProb >= 50) { weatherCondition = '비 예보'; weatherIcon = '☔'; }

            const newWeatherData = { temp: temperature, condition: weatherCondition, icon: weatherIcon, willRainLater, maxRainProb };

            // 최신 날씨로 화면 덮어쓰기
            setWeatherData(newWeatherData);

            // 🚀 [최적화 3] 다음 접속을 위해 날씨 + 동네 이름을 캐시에 함께 저장!
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                ncstDate: ncstDate, ncstTime: ncstTime,
                gridX: grid.x, gridY: grid.y,
                weather: newWeatherData,
                locationName: currentDongName // 동네 이름도 저장
            }));

        } catch (error) {
            console.error('날씨 정보를 가져오는 중 오류 발생:', error);
            if (!hasValidCache) {
                setWeatherData({ temp: '-', condition: '알 수 없음', icon: '❓', willRainLater: false, maxRainProb: 0 });
                setLocationName('위치 확인 불가');
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWeatherAndLocation();
    }, [fetchWeatherAndLocation]);

    return { weatherData, locationName, isLoading, refreshWeather: fetchWeatherAndLocation };
};