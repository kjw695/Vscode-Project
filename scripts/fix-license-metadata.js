// npm-license-crawler가 찾지 못한 일부 공식 링크와 앱 자체 항목을 보완합니다.
// 실제 패키지 버전이 일치하는 항목만 수정하며, 기존에 생성된 나머지 정보는 보존합니다.
const fs = require('fs');
const path = require('path');

const licensesPath = path.join(__dirname, '..', 'public', 'licenses.json');

if (!fs.existsSync(licensesPath)) {
  console.error('public/licenses.json 파일이 없습니다. 먼저 npm run licenses를 실행해 주세요.');
  process.exit(1);
}

const licenses = JSON.parse(fs.readFileSync(licensesPath, 'utf8'));

const corrections = {
  '@capacitor/synapse@1.0.4': {
    licenses: 'ISC',
    packageUrl: 'https://www.npmjs.com/package/@capacitor/synapse',
    licenseUrl: 'https://spdx.org/licenses/ISC.html',
    licenseNote: 'npm 패키지 메타데이터는 ISC로 표시합니다. 배포본 LICENSE 파일은 MIT로 표기된 사례도 있어, 최종 고지 전 설치된 패키지의 LICENSE 파일을 대조해야 합니다.'
  },
  '@isaacs/brace-expansion@5.0.0': {
    licenses: 'MIT',
    repository: 'https://github.com/isaacs/brace-expansion',
    licenseUrl: 'https://github.com/isaacs/brace-expansion/blob/v5.0.0/LICENSE'
  },
  '@nicolo-ribaudo/eslint-scope-5-internals@5.1.1-v1': {
    licenses: 'MIT',
    packageUrl: 'https://www.npmjs.com/package/@nicolo-ribaudo/eslint-scope-5-internals',
    licenseUrl: 'https://spdx.org/licenses/MIT.html',
    licenseNote: '저작권 표기: Copyright 2022 Nicol Ribaudo'
  },
  '@trapezedev/gradle-parse@7.1.3': {
    licenses: 'MIT',
    repository: 'https://github.com/ionic-team/trapeze',
    licenseUrl: 'https://github.com/ionic-team/trapeze/blob/main/LICENSE'
  },
  'client-only@0.0.1': {
    licenses: 'MIT',
    packageUrl: 'https://www.npmjs.com/package/client-only',
    licenseUrl: 'https://spdx.org/licenses/MIT.html',
    licenseNote: 'npm 배포 메타데이터에는 MIT가 선언되어 있으나, 패키지 자체 저장소 및 개별 저작권 표기는 확인되지 않았습니다.'
  },
  'dotenv-expand@5.1.0': {
    licenses: 'BSD-2-Clause',
    repository: 'https://github.com/dotenvx/dotenv-expand',
    licenseUrl: 'https://github.com/dotenvx/dotenv-expand/blob/v5.1.0/LICENSE'
  },
  'nopt-usage@0.1.0': {
    licenses: 'MIT',
    packageUrl: 'https://www.npmjs.com/package/nopt-usage',
    licenseUrl: 'https://spdx.org/licenses/MIT.html'
  }
};

let updated = 0;
const notFound = [];

for (const [key, patch] of Object.entries(corrections)) {
  if (!licenses[key]) {
    notFound.push(key);
    continue;
  }

  Object.assign(licenses[key], patch);
  updated += 1;
}

// 애플리케이션 자체는 제3자 오픈소스 패키지가 아니므로 오픈소스 목록에서 제외합니다.
const appEntry = 'delivery-tracker-app@0.1.0';
const removedAppEntry = Object.prototype.hasOwnProperty.call(licenses, appEntry);
if (removedAppEntry) {
  delete licenses[appEntry];
}

fs.writeFileSync(licensesPath, JSON.stringify(licenses, null, 4) + '\n', 'utf8');

console.log(`라이선스 메타데이터 보완: ${updated}/${Object.keys(corrections).length}개`);
console.log(`앱 자체 항목 제거: ${removedAppEntry ? '완료' : '해당 없음'}`);

if (notFound.length > 0) {
  console.warn('현재 licenses.json에서 버전이 일치하는 항목을 찾지 못했습니다:');
  notFound.forEach((key) => console.warn(`- ${key}`));
}

console.log('public/licenses.json 저장 완료');
