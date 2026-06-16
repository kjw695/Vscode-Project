const fs = require('fs');
const path = require('path');

// node_modules 폴더 기본 경로
const nodeModulesDir = path.join(__dirname, '..', 'node_modules');

// 폴더를 순회하며 build.gradle 파일을 찾는 함수
function findAndFixGradleFiles(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // node_modules 안의 node_modules 등 무한루프 방지
            if (file !== 'node_modules') {
                findAndFixGradleFiles(fullPath); 
            }
        } else if (file === 'build.gradle') {
            fixFile(fullPath); 
        }
    }
}

// 파일 내용을 읽고 문제가 되는 텍스트를 찾아 치환하는 함수
function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const searchStr = "getDefaultProguardFile('proguard-android.txt')";
    const replaceStr = "getDefaultProguardFile('proguard-android-optimize.txt')";

    if (content.includes(searchStr)) {
        // 정규식을 사용해 모든 일치 항목 치환
        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        content = content.replace(new RegExp(escapeRegExp(searchStr), 'g'), replaceStr);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ [자동 수정 완료] ${filePath}`);
    }
}

console.log('🔍 Capacitor 및 전체 플러그인 구형 Gradle 설정 스캔 시작...');

if (fs.existsSync(nodeModulesDir)) {
    const items = fs.readdirSync(nodeModulesDir);
    for (const item of items) {
        const itemPath = path.join(nodeModulesDir, item);
        
        if (fs.statSync(itemPath).isDirectory()) {
            // ✨ 핵심 로직: @로 시작하는 스코프 폴더나 이름에 capacitor가 포함된 폴더만 광범위하게 타겟팅
            if (item.startsWith('@') || item.toLowerCase().includes('capacitor')) {
                findAndFixGradleFiles(itemPath);
            }
        }
    }
}

console.log('✨ 스캔 및 자동 수정 완료.');