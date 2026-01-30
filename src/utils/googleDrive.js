import { Capacitor } from '@capacitor/core';

// ⚠️ [보안 개선] API 키는 코드에 하드코딩하지 말고 .env 파일로 관리하는 것을 권장합니다.
// .env 파일 예시: REACT_APP_GOOGLE_CLIENT_ID=...
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'; 
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY';

// 앱 데이터 전용 폴더 접근 권한
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata'; 
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let cachedAccessToken = null;
let tokenExpirationTime = 0;

/**
 * Google API(gapi) 스크립트 로드 및 초기화
 */
function gapiLoaded() {
    window.gapi.load('client', async () => {
        try {
            await window.gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: [DISCOVERY_DOC],
            });
            gapiInited = true;
            console.log("GAPI 초기화 성공");
        } catch (error) {
            console.error("GAPI 초기화 실패 (API KEY 확인 필요):", error);
            // 초기화 실패 시 사용자에게 알림을 줄 수도 있습니다.
        }
    });
}

/**
 * Google Identity Services(gis) 스크립트 로드 및 초기화
 */
function gisLoaded() {
    try {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    cachedAccessToken = tokenResponse.access_token;
                    // 토큰 만료 시간 설정 (약 50분)
                    tokenExpirationTime = Date.now() + (tokenResponse.expires_in * 1000) - (10 * 60 * 1000);
                }
            },
        });
        gisInited = true;
        console.log("GIS 초기화 성공");
    } catch (error) {
        console.error("GIS 초기화 실패 (Client ID 확인 필요):", error);
    }
}

/**
 * 스크립트가 없으면 동적으로 로드하는 함수 (타임아웃 적용)
 */
const loadGoogleScripts = () => {
    return new Promise((resolve, reject) => {
        // 이미 로드 완료 상태라면 즉시 반환
        if (gapiInited && gisInited) {
            resolve();
            return;
        }

        // 스크립트 태그가 없으면 삽입
        if (!document.getElementById('gapi-script')) {
            const script1 = document.createElement('script');
            script1.id = 'gapi-script';
            script1.src = 'https://apis.google.com/js/api.js';
            script1.onload = gapiLoaded;
            script1.onerror = () => console.error("GAPI 스크립트 로드 실패");
            document.body.appendChild(script1);
        }

        if (!document.getElementById('gis-script')) {
            const script2 = document.createElement('script');
            script2.id = 'gis-script';
            script2.src = 'https://accounts.google.com/gsi/client';
            script2.onload = gisLoaded;
            script2.onerror = () => console.error("GIS 스크립트 로드 실패");
            document.body.appendChild(script2);
        }

        // 로드 대기 (최대 5초)
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if (gapiInited && gisInited) {
                clearInterval(checkInterval);
                resolve();
            }
            
            if (attempts > 50) { // 5초 경과
                clearInterval(checkInterval);
                const errorMsg = "Google 스크립트 로딩 시간이 초과되었습니다.\n인터넷 연결을 확인하거나, API Key/Client ID가 올바른지 확인해주세요.";
                console.error(errorMsg);
                reject(new Error(errorMsg));
            }
        }, 100);
    });
};

/**
 * 유효한 액세스 토큰 가져오기 (만료 시 팝업 요청)
 */
const getValidAccessToken = async () => {
    try {
        await loadGoogleScripts();
    } catch (e) {
        alert(e.message);
        return null;
    }

    const now = Date.now();

    // 1) 유효한 토큰이 있으면 재사용 (팝업 X)
    if (cachedAccessToken && now < tokenExpirationTime) {
        // console.log("🔑 기존 열쇠 재사용 (팝업 X)");
        return cachedAccessToken;
    }

    // 2) 토큰이 없거나 만료되면 새 토큰 요청 (팝업 O)
    // console.log("🔔 새 열쇠 요청 (팝업 O)");
    
    return new Promise((resolve, reject) => {
        try {
            if (!tokenClient) {
                throw new Error("인증 클라이언트가 초기화되지 않았습니다.");
            }

            tokenClient.callback = (resp) => {
                if (resp.error) {
                    console.error("토큰 요청 에러:", resp);
                    reject(resp);
                    return;
                }
                cachedAccessToken = resp.access_token;
                tokenExpirationTime = Date.now() + (resp.expires_in * 1000) - (10 * 60 * 1000);
                resolve(cachedAccessToken);
            };
            
            // 팝업 차단 방지를 위해 사용자 클릭 이벤트 내에서 호출되어야 함
            tokenClient.requestAccessToken({ prompt: '' });
        } catch (err) {
            console.error("토큰 요청 중 예외 발생:", err);
            reject(err);
        }
    });
};

// ============================================================
// 3. 백업 함수 (업로드) - 🔥 [원칙 준수] ID 삭제
// ============================================================
export const backupToDrive = async (myData) => {
    if (!myData || myData.length === 0) {
        alert("백업할 데이터가 없습니다.");
        return;
    }

    try {
        const accessToken = await getValidAccessToken();
        if (!accessToken) return; // 토큰 발급 실패 시 중단

        // 🔥 [원칙 적용] 내보낼 때 ID 삭제
        // 원본 데이터를 손상시키지 않기 위해 map으로 새로운 객체 배열 생성
        const sanitizedData = myData.map(item => {
            const { id, ...rest } = item; // id 필드 제거 (나머지 필드만 남김)
            return rest;
        });

        const metadata = { 
            name: 'delivery_backup.json', 
            parents: ['appDataFolder'] 
        };
        
        // ID가 제거된 데이터를 JSON으로 변환
        const fileContent = JSON.stringify(sanitizedData);
        const file = new Blob([fileContent], { type: 'application/json' });
        
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', file);

        // 1. 기존 파일 검색
        const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='delivery_backup.json'", {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (!searchRes.ok) {
            throw new Error("구글 드라이브 검색 실패: " + searchRes.status);
        }
        
        const searchData = await searchRes.json();

        // 2. 업로드 URL 및 메서드 결정 (기존 파일 있으면 덮어쓰기 PATCH, 없으면 새로 생성 POST)
        let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';

        if (searchData.files && searchData.files.length > 0) {
            const fileId = searchData.files[0].id;
            url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            method = 'PATCH';
        }

        // 3. 업로드 실행
        const response = await fetch(url, {
            method: method,
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData
        });

        if (response.ok) {
            console.log("✅ 구글 드라이브 백업 성공");
            alert("구글 드라이브 백업이 완료되었습니다.");
        } else {
            const errorData = await response.json();
            console.error('업로드 응답 에러:', errorData);
            throw new Error('업로드 실패: ' + (errorData.error?.message || "알 수 없는 오류"));
        }

    } catch (error) {
        console.error("백업 중 오류 발생:", error);
        alert("백업 실패: " + (error.message || error));
    }
};

// ============================================================
// 4. 복원 함수 (다운로드)
// ============================================================
export const restoreFromDrive = async () => {
    try {
        const accessToken = await getValidAccessToken();
        if (!accessToken) return null;

        const listRes = await fetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='delivery_backup.json'", {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (!listRes.ok) throw new Error("파일 목록 조회 실패");

        const listData = await listRes.json();

        if (!listData.files?.length) {
            alert("❌ 저장된 백업 파일이 없습니다.");
            return null;
        }

        const fileId = listData.files[0].id;
        const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!fileRes.ok) throw new Error("파일 다운로드 실패");

        const data = await fileRes.json();
        
        // 참고: 복원된 데이터에는 ID가 없으므로, 이를 받아 처리하는 곳(App.js 등)에서
        // 새 ID를 부여하는 로직을 수행해야 합니다. (원칙 준수)
        return data;

    } catch (error) {
        alert("복원 실패: " + (error.message || error));
        console.error(error);
        return null;
    }
};