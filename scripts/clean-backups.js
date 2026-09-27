//node scripts/clean-backups.js


const fs = require('fs');
const path = require('path');

// 프로젝트 최상단 폴더 기준 경로
const projectDir = path.join(__dirname, '..');

function cleanDuplicates(dir) {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        // 정규식: 빈칸 뒤에 숫자, 괄호숫자, 복사본, copy 등이 붙은 이름 탐지
        const isDuplicate = /(?:\s+\d+|\s+\(\d+\)|\s+복사본|\s+copy)(?:\.[a-zA-Z0-9_]+)?$/i.test(item);

        if (stat.isDirectory()) {
            if (isDuplicate) {
                // ✨ 찌꺼기 폴더인 경우 폴더째로 통째로 삭제!
                try {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                    console.log(`📁 찌꺼기 폴더 삭제 완료: ${item}`);
                } catch (error) {
                    console.log(`❌ 폴더 삭제 실패: ${item}`);
                }
            } else if (item !== 'node_modules' && !item.startsWith('.')) {
                // 정상적인 폴더라면 그 안으로 들어가서 계속 스캔
                cleanDuplicates(fullPath);
            }
        } else {
            // 파일인 경우
            if (isDuplicate) {
                try {
                    fs.unlinkSync(fullPath);
                    console.log(`📄 찌꺼기 파일 삭제 완료: ${item}`);
                } catch (error) {
                    console.log(`❌ 파일 삭제 실패: ${item}`);
                }
            }
        }
    }
}

console.log('🔍 3차 스캔 (폴더 및 파일 동시 타격) 시작...');
cleanDuplicates(projectDir);
console.log('✨ 청소 완료! 안드로이드 스튜디오에서 코끼리 아이콘(Sync)을 눌러주세요.');