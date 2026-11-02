// Weekly upload workbook generator. All exported cells are strings so IDs,
// registration numbers, dates and route codes retain their exact text.
export const WEEKLY_EXCEL_HEADERS = [
    '업무일',
    '사업자등록번호',
    '캠프명',
    '웨이브',
    '아이디',
    '업무상태',
    '회전',
    '업무라우트'
];

const DAY_ROTATIONS = ['1회전', '2회전'];
const NIGHT_ROTATIONS = ['D1', 'D2', 'F3'];

function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

function isNightTeam(team) {
    const shift = String(team?.shift || team?.workShift || team?.work_shift || '').toLowerCase();
    return shift === 'night' || shift === '야간';
}

function normalizeCommaList(value) {
    const values = Array.isArray(value)
        ? value
        : String(value || '').split(',');
    return values
        .map(function (item) { return String(item || '').trim(); })
        .filter(Boolean)
        .join(',');
}

function isEmployeeOff(record, employee) {
    const ids = Array.isArray(record?.offEmployeeIds) ? record.offEmployeeIds : [];
    if (ids.some(function (item) {
        const id = item && typeof item === 'object'
            ? (item.employeeId || item.employee_id || item.id)
            : item;
        return String(id) === String(employee.id);
    })) return true;

    const names = []
        .concat(Array.isArray(record?.offs) ? record.offs : [])
        .concat(Array.isArray(record?.subOffs) ? record.subOffs : []);
    return names.some(function (item) {
        if (item && typeof item === 'object') {
            return String(item.employeeId || item.employee_id || item.id || '') === String(employee.id) ||
                String(item.name || item.employeeName || '') === String(employee.name || '');
        }
        return String(item) === String(employee.id) || String(item) === String(employee.name);
    });
}

function getEmployeeAssignment(record, employee) {
    return (Array.isArray(record?.subs) ? record.subs : []).find(function (item) {
        return String(item.subId) === String(employee.id);
    }) || null;
}

function getEmployeeRoutes(employee, routes) {
    const assigned = routes
        .filter(function (route) {
            return String(route.assigned_emp_id) === String(employee.id);
        })
        .map(function (route) { return route.name; });
    if (assigned.length > 0) return normalizeCommaList(assigned);
    return normalizeCommaList(employee.route || employee.routeName || employee.route_name || '');
}

function getEmployeeLoginId(employee) {
    return String(
        employee.accountUsername ||
        employee.username ||
        employee.exportLoginId ||
        ''
    ).trim();
}

function getRotationValue(employee, allowedRotations) {
    const saved = Array.isArray(employee.excelRotations)
        ? employee.excelRotations
        : String(employee.excelRotations || '').split(',');
    const selected = allowedRotations.filter(function (rotation) {
        return saved.some(function (value) { return String(value).trim() === rotation; });
    });
    return selected.join(',');
}

export function buildWeeklyScheduleExportRows(options) {
    const opts = options || {};
    const employees = Array.isArray(opts.employees) ? opts.employees : [];
    const routes = Array.isArray(opts.routes) ? opts.routes : [];
    const schedule = opts.schedule || {};
    const weekDates = Array.isArray(opts.weekDates) ? opts.weekDates : [];
    const team = opts.team || {};
    const businessNumber = String(opts.businessRegistrationNumber || '').replace(/[^0-9]/g, '');
    const campName = String(opts.campName || '').trim();
    const night = isNightTeam(team);
    const wave = night ? 'WAVE1' : 'WAVE2';
    const allowedRotations = night ? NIGHT_ROTATIONS : DAY_ROTATIONS;
    const errors = [];

    if (weekDates.length !== 7) errors.push('일요일부터 토요일까지 7일의 날짜가 필요합니다.');
    if (businessNumber.length !== 10) errors.push('회사 설정에서 사업자등록번호 10자리를 먼저 저장해주세요.');
    if (!campName) errors.push('엑셀 설정에서 해당 팀의 캠프명을 입력해주세요.');
    if (employees.length === 0) errors.push('선택한 팀에 내보낼 직원이 없습니다.');

    const rows = [WEEKLY_EXCEL_HEADERS.slice()];
    employees.filter(function (employee) { return employee.active !== false; }).forEach(function (employee) {
        const loginId = getEmployeeLoginId(employee);
        if (!loginId) {
            errors.push((employee.name || '이름 없는 직원') + ': 업로드 아이디가 없습니다.');
            return;
        }

        const isBackup = String(employee.type || employee.employee_type || employee.employeeType || '').toLowerCase() === 'sub' ||
            String(employee.type || employee.employee_type || employee.employeeType || '').toLowerCase() === 'substitute' ||
            String(employee.type || employee.employee_type || employee.employeeType || '').toLowerCase() === 'backup';
        const rotation = getRotationValue(employee, allowedRotations);

        weekDates.forEach(function (date) {
            const dateKey = localDateString(date);
            const record = schedule[dateKey];
            if (!record) {
                errors.push(dateKey + ': 근무표가 생성되지 않았습니다.');
                return;
            }

            const assignment = isBackup ? getEmployeeAssignment(record, employee) : null;
            const isOff = isEmployeeOff(record, employee);
            // 화면의 주간근무표와 동일하게, 휴무로 지정되지 않은 백업 직원은 출근으로 표시합니다.
            // 대체 배정이 있으면 대체 대상의 라우트를 사용하고, 대기 근무는 라우트를 비워 둡니다.
            const isWorking = !isOff;
            const status = isWorking ? '출근' : '휴무';
            let routeValue = '';

            if (isWorking) {
                routeValue = isBackup
                    ? normalizeCommaList(assignment?.routeName || '')
                    : getEmployeeRoutes(employee, routes);
                if (!rotation) {
                    errors.push((employee.name || loginId) + ': ' + allowedRotations.join(', ') + ' 중 회전을 설정해주세요.');
                }
                if (!isBackup && !routeValue) {
                    errors.push((employee.name || loginId) + ': ' + dateKey + ' 업무라우트가 배정되지 않았습니다.');
                }
                if (isBackup && assignment && !routeValue) {
                    errors.push((employee.name || loginId) + ': ' + dateKey + ' 백업 배정 라우트가 비어 있습니다.');
                }
            }

            rows.push([
                dateKey,
                businessNumber,
                campName,
                wave,
                loginId,
                status,
                isWorking ? rotation : '',
                isWorking ? routeValue : ''
            ]);
        });
    });

    if (errors.length > 0) {
        const uniqueErrors = Array.from(new Set(errors));
        const visibleErrors = uniqueErrors.slice(0, 8);
        const remaining = uniqueErrors.length - visibleErrors.length;
        throw new Error(
            '엑셀을 만들기 전에 아래 설정을 확인해주세요.\n\n' +
            visibleErrors.join('\n') +
            (remaining > 0 ? '\n외 ' + remaining + '건' : '')
        );
    }

    return rows;
}

function xmlEscape(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function columnName(index) {
    let value = index + 1;
    let result = '';
    while (value > 0) {
        const remainder = (value - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        value = Math.floor((value - 1) / 26);
    }
    return result;
}

function worksheetXml(rows) {
    const rowXml = rows.map(function (row, rowIndex) {
        const cells = row.map(function (value, columnIndex) {
            const reference = columnName(columnIndex) + (rowIndex + 1);
            const style = rowIndex === 0 ? ' s="1"' : '';
            const text = xmlEscape(value);
            return '<c r="' + reference + '" t="inlineStr"' + style + '><is><t xml:space="preserve">' + text + '</t></is></c>';
        }).join('');
        return '<row r="' + (rowIndex + 1) + '">' + cells + '</row>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
        '<sheetFormatPr defaultRowHeight="19"/>' +
        '<cols>' +
        '<col min="1" max="1" width="14" customWidth="1"/>' +
        '<col min="2" max="2" width="17" customWidth="1"/>' +
        '<col min="3" max="3" width="14" customWidth="1"/>' +
        '<col min="4" max="4" width="11" customWidth="1"/>' +
        '<col min="5" max="5" width="19" customWidth="1"/>' +
        '<col min="6" max="6" width="12" customWidth="1"/>' +
        '<col min="7" max="7" width="17" customWidth="1"/>' +
        '<col min="8" max="8" width="30" customWidth="1"/>' +
        '</cols>' +
        '<sheetData>' + rowXml + '</sheetData>' +
        '<autoFilter ref="A1:H' + Math.max(1, rows.length) + '"/>' +
        '</worksheet>';
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let value = n;
        for (let k = 0; k < 8; k += 1) {
            value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        }
        table[n] = value >>> 0;
    }
    return table;
}());

function concatBytes(chunks) {
    const total = chunks.reduce(function (sum, item) { return sum + item.length; }, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    chunks.forEach(function (item) {
        result.set(item, offset);
        offset += item.length;
    });
    return result;
}

function zipStore(files) {
    const encoder = new TextEncoder();
    const localChunks = [];
    const centralChunks = [];
    let localOffset = 0;
    let centralSize = 0;

    files.forEach(function (file) {
        const name = encoder.encode(file.name);
        const data = encoder.encode(file.content);
        const checksum = crc32(data);
        const localHeader = new Uint8Array(30 + name.length);
        const localView = new DataView(localHeader.buffer);
        localView.setUint32(0, 0x04034b50, true);
        localView.setUint16(4, 20, true);
        localView.setUint16(6, 0x0800, true);
        localView.setUint16(8, 0, true);
        localView.setUint16(10, 0, true);
        localView.setUint16(12, 0x0021, true);
        localView.setUint32(14, checksum, true);
        localView.setUint32(18, data.length, true);
        localView.setUint32(22, data.length, true);
        localView.setUint16(26, name.length, true);
        localView.setUint16(28, 0, true);
        localHeader.set(name, 30);

        const centralHeader = new Uint8Array(46 + name.length);
        const centralView = new DataView(centralHeader.buffer);
        centralView.setUint32(0, 0x02014b50, true);
        centralView.setUint16(4, 20, true);
        centralView.setUint16(6, 20, true);
        centralView.setUint16(8, 0x0800, true);
        centralView.setUint16(10, 0, true);
        centralView.setUint16(12, 0, true);
        centralView.setUint16(14, 0x0021, true);
        centralView.setUint32(16, checksum, true);
        centralView.setUint32(20, data.length, true);
        centralView.setUint32(24, data.length, true);
        centralView.setUint16(28, name.length, true);
        centralView.setUint16(30, 0, true);
        centralView.setUint16(32, 0, true);
        centralView.setUint16(34, 0, true);
        centralView.setUint16(36, 0, true);
        centralView.setUint32(38, 0, true);
        centralView.setUint32(42, localOffset, true);
        centralHeader.set(name, 46);

        localChunks.push(localHeader, data);
        centralChunks.push(centralHeader);
        localOffset += localHeader.length + data.length;
        centralSize += centralHeader.length;
    });

    const centralOffset = localOffset;
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, centralOffset, true);
    endView.setUint16(20, 0, true);

    return concatBytes(localChunks.concat(centralChunks, [end]));
}

export function createWeeklyScheduleXlsxBytes(rows, sheetName) {
    const safeRows = Array.isArray(rows) && rows.length > 0 ? rows : [WEEKLY_EXCEL_HEADERS];
    const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const files = [
        {
            name: '[Content_Types].xml',
            content: xml + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                '<Default Extension="xml" ContentType="application/xml"/>' +
                '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
                '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
                '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
                '</Types>'
        },
        {
            name: '_rels/.rels',
            content: xml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
                '</Relationships>'
        },
        {
            name: 'xl/workbook.xml',
            content: xml + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
                '<sheets><sheet name="' + xmlEscape(sheetName || '근무표') + '" sheetId="1" r:id="rId1"/></sheets></workbook>'
        },
        {
            name: 'xl/_rels/workbook.xml.rels',
            content: xml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
                '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
                '</Relationships>'
        },
        {
            name: 'xl/styles.xml',
            content: xml + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
                '<fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="맑은 고딕"/></font></fonts>' +
                '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF334155"/><bgColor indexed="64"/></patternFill></fill></fills>' +
                '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border></borders>' +
                '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
                '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyAlignment="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf></cellXfs>' +
                '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
                '</styleSheet>'
        },
        {
            name: 'xl/worksheets/sheet1.xml',
            content: worksheetXml(safeRows)
        }
    ];
    return zipStore(files);
}
