/**
 * 용강 만들기 — Google Apps Script 백엔드
 * 플레이어 등록/조회, 게임 결과 기록, 하이스코어 관리
 * 1시간 쿨다운, 사번 중복 처리, 소프트 삭제 지원
 *
 * 배포: script.google.com → 새 프로젝트 → 이 코드 붙여넣기
 *   → 배포 → 웹앱
 *   → 실행: 나, 액세스: 모든 사용자(익명 포함)
 *   → 배포 후 URL을 game-data.js googleSheets.endpoint 에 입력
 */

const SPREADSHEET_ID = '1bdcRVCFmTrgMUi-CFj28E-AknJjqb8HxHghfyU_XuB8';
const SHEET_PLAYERS = 'Players';
const SHEET_RECORDS = 'GameRecords';
const SHEET_DELETED = 'DeletedPlayers';

const HEADERS_PLAYERS = ['nickname', 'employeeId', 'highScore', 'totalGames', 'createdAt', 'lastPlayedAt'];
const HEADERS_RECORDS = ['timestamp', 'nickname', 'employeeId', 'startScore', 'endScore', 'maxTier', 'mergeCount', 'durationMs', 'quizCorrectCount', 'quizFailReason'];

/** 1시간 쿨다운 (밀리초) */
const COOLDOWN_MS = 60 * 60 * 1000;

function getSS() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/** 최초 실행 시 시트 초기화 + 기존 시트 마이그레이션 */
function setup() {
  const ss = getSS();
  ensureSheet_(ss, SHEET_PLAYERS, HEADERS_PLAYERS);
  ensureSheet_(ss, SHEET_RECORDS, HEADERS_RECORDS);
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  // 마이그레이션: 헤더가 부족하면 새 컬럼 추가
  const lastCol = sheet.getLastColumn();
  if (lastCol < headers.length) {
    for (let c = lastCol; c < headers.length; c++) {
      sheet.getRange(1, c + 1).setValue(headers[c]);
    }
  }
  return sheet;
}

/** GET — 플레이어 등록/조회, 리더보드 */
function doGet(e) {
  const params = e.parameter || {};
  const action = params.action || '';

  if (action === 'register') {
    return registerPlayer_(params.nickname, params.employeeId);
  }
  if (action === 'leaderboard') {
    return getLeaderboard_();
  }
  if (action === 'changeNickname') {
    return changeNickname_(params.employeeId, params.newNickname);
  }

  return jsonOut_({ status: 'ok', message: '용강 만들기 API' });
}

/** POST — 게임 결과 기록, 닉네임 변경, 기록 삭제 */
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ status: 'error', message: 'Invalid JSON' });
  }

  if (data.action === 'register') {
    return registerPlayer_(data.nickname, data.employeeId);
  }
  if (data.action === 'recordResult' || data.endScore !== undefined) {
    return recordResult_(data);
  }
  if (data.action === 'changeNickname') {
    return changeNickname_(data.employeeId, data.newNickname);
  }
  if (data.action === 'deletePlayer') {
    return deletePlayer_(data.employeeId, data.confirmNickname);
  }

  return jsonOut_({ status: 'error', message: 'Unknown action' });
}

/**
 * 플레이어 등록 또는 기존 조회
 * 사번(employeeId)을 기준으로 식별한다.
 *
 * 응답 케이스:
 *  - status 'ok': 정상 등록 또는 기존 플레이어 (쿨다운 통과)
 *  - status 'employeeIdConflict': 사번은 있으나 닉네임이 다름 → 프론트에서 선택 유도
 *  - status 'cooldown': 1시간 이내 재플레이 시도 → remainingMinutes 반환
 */
function registerPlayer_(nickname, employeeId) {
  if (!nickname || !employeeId) {
    return jsonOut_({ status: 'error', message: 'nickname, employeeId 필요' });
  }
  setup();

  const ss = getSS();
  const sheet = ss.getSheetByName(SHEET_PLAYERS);
  const values = sheet.getDataRange().getValues();
  const rowCount = values.length;

  for (let i = 1; i < rowCount; i++) {
    if (String(values[i][1]) === String(employeeId)) {
      const existingNickname = values[i][0];

      // 닉네임이 다르면 충돌 알림
      if (existingNickname !== nickname) {
        return jsonOut_({
          status: 'employeeIdConflict',
          existingNickname: existingNickname,
          inputNickname: nickname,
          employeeId: String(employeeId),
          message: '이 사번으로 등록된 닉네임이 이미 있습니다.'
        });
      }

      // 닉네임 일치 — 쿨다운 체크
      const lastPlayedRaw = values[i][5];
      if (lastPlayedRaw) {
        const lastPlayedAt = new Date(lastPlayedRaw).getTime();
        const elapsed = Date.now() - lastPlayedAt;
        if (elapsed < COOLDOWN_MS) {
          const remainingMin = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
          return jsonOut_({
            status: 'cooldown',
            remainingMinutes: remainingMin,
            nickname: nickname,
            employeeId: String(employeeId),
            highScore: Number(values[i][2]) || 0,
            message: remainingMin + '분 후 다시 플레이할 수 있습니다.'
          });
        }
      }

      return jsonOut_({
        status: 'ok',
        action: 'register',
        isNew: false,
        nickname: nickname,
        employeeId: String(employeeId),
        highScore: Number(values[i][2]) || 0,
        totalGames: Number(values[i][3]) || 0,
        message: '기존 플레이어 기록을 불러왔습니다.'
      });
    }
  }

  // 신규 등록
  sheet.appendRow([nickname, String(employeeId), 0, 0, new Date().toISOString(), '']);
  return jsonOut_({
    status: 'ok',
    action: 'register',
    isNew: true,
    nickname: nickname,
    employeeId: String(employeeId),
    highScore: 0,
    totalGames: 0,
    message: '신규 플레이어로 등록되었습니다.'
  });
}

/**
 * 닉네임 변경 (사번 기준)
 * 기존 기록(하이스코어, 플레이 횟수)은 그대로 유지하고 닉네임만 교체한다.
 */
function changeNickname_(employeeId, newNickname) {
  if (!employeeId || !newNickname) {
    return jsonOut_({ status: 'error', message: 'employeeId, newNickname 필요' });
  }
  setup();

  const ss = getSS();
  const sheet = ss.getSheetByName(SHEET_PLAYERS);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]) === String(employeeId)) {
      sheet.getRange(i + 1, 1).setValue(newNickname); // nickname 컬럼만 업데이트
      return jsonOut_({
        status: 'ok',
        action: 'changeNickname',
        nickname: newNickname,
        employeeId: String(employeeId),
        highScore: Number(values[i][2]) || 0,
        totalGames: Number(values[i][3]) || 0,
        message: '닉네임이 변경되었습니다.'
      });
    }
  }
  return jsonOut_({ status: 'error', message: '해당 사번의 플레이어를 찾을 수 없습니다.' });
}

/**
 * 기존 기록 삭제 — 소프트 삭제 + 닉네임 확인
 *
 * 안전장치:
 *  1. confirmNickname이 기존 닉네임과 정확히 일치해야 함
 *     (다른 사람이 사번만 알고 삭제하는 것을 차단)
 *  2. 실제 삭제가 아닌 DeletedPlayers 시트로 이관 (복구 가능)
 */
function deletePlayer_(employeeId, confirmNickname) {
  if (!employeeId || !confirmNickname) {
    return jsonOut_({ status: 'error', message: 'employeeId, confirmNickname 필요' });
  }
  setup();

  const ss = getSS();
  const sheet = ss.getSheetByName(SHEET_PLAYERS);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]) === String(employeeId)) {
      // 닉네임 검증
      if (values[i][0] !== confirmNickname) {
        return jsonOut_({
          status: 'error',
          message: '기존 닉네임이 일치하지 않아 삭제할 수 없습니다.'
        });
      }

      // 소프트 삭제: DeletedPlayers 시트로 이관
      const delSheet = ensureSheet_(ss, SHEET_DELETED, HEADERS_PLAYERS);
      delSheet.appendRow([
        values[i][0],
        values[i][1],
        Number(values[i][2]) || 0,
        Number(values[i][3]) || 0,
        values[i][4] || '',
        values[i][5] || new Date().toISOString()
      ]);

      // 원본 행 삭제
      sheet.deleteRow(i + 1);

      return jsonOut_({
        status: 'ok',
        action: 'deletePlayer',
        message: '기존 기록이 삭제되었습니다. 관리자를 통해 복구할 수 있습니다.'
      });
    }
  }
  return jsonOut_({ status: 'error', message: '해당 사번의 플레이어를 찾을 수 없습니다.' });
}

/** 게임 결과 기록 + 하이스코어 갱신 + lastPlayedAt 업데이트 */
function recordResult_(data) {
  setup();

  const ss = getSS();

  // 1) GameRecords 시트에 기록
  const recSheet = ss.getSheetByName(SHEET_RECORDS);
  recSheet.appendRow([
    new Date().toISOString(),
    data.nickname || 'unknown',
    String(data.employeeId || ''),
    Number(data.startScore) || 0,
    Number(data.endScore) || 0,
    data.maxTier || '',
    Number(data.mergeCount) || 0,
    Number(data.durationMs) || 0,
    Number(data.quizCorrectCount) || 0,
    data.quizFailReason || ''
  ]);

  // 2) Players 시트 갱신 (하이스코어, totalGames, lastPlayedAt)
  const pSheet = ss.getSheetByName(SHEET_PLAYERS);
  const pValues = pSheet.getDataRange().getValues();
  let isNewHighScore = false;
  let prevHigh = 0;
  const now = new Date().toISOString();

  for (let i = 1; i < pValues.length; i++) {
    if (String(pValues[i][1]) === String(data.employeeId || '')) {
      prevHigh = Number(pValues[i][2]) || 0;
      const totalGames = (Number(pValues[i][3]) || 0) + 1;
      const endScore = Number(data.endScore) || 0;
      if (endScore > prevHigh) {
        pSheet.getRange(i + 1, 3).setValue(endScore);     // highScore
        isNewHighScore = true;
      }
      pSheet.getRange(i + 1, 4).setValue(totalGames);      // totalGames
      pSheet.getRange(i + 1, 6).setValue(now);             // lastPlayedAt
      break;
    }
  }

  return jsonOut_({
    status: 'ok',
    action: 'recordResult',
    endScore: Number(data.endScore) || 0,
    prevHighScore: prevHigh,
    isNewHighScore: isNewHighScore,
    message: isNewHighScore ? '신기록 달성!' : '기록되었습니다.'
  });
}

/** 리더보드 (상위 20) */
function getLeaderboard_() {
  setup();
  const ss = getSS();
  const sheet = ss.getSheetByName(SHEET_PLAYERS);
  const values = sheet.getDataRange().getValues();
  const board = [];
  for (let i = 1; i < values.length; i++) {
    board.push({
      nickname: values[i][0],
      employeeId: String(values[i][1]),
      highScore: Number(values[i][2]) || 0,
      totalGames: Number(values[i][3]) || 0
    });
  }
  board.sort(function(a, b) { return b.highScore - a.highScore; });
  return jsonOut_({ status: 'ok', leaderboard: board.slice(0, 20) });
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
