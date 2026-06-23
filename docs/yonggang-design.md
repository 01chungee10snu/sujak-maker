# 용강 만들기 디자인 노트

## 게임 이름
용강 만들기

## 최종 목표 캐릭터
- 이름: 용강
- 설정: 제철 밸류체인의 공정과 제품 흐름으로 태어나는 주황색 생물.
- 외형 기준: 둥근 주황/노랑 얼굴, 진한 남색 외곽선, 위쪽이 움푹 파인 두 봉우리 형태, 작은 물방울, 볼터치, 작은 검은 눈과 입, 파란 작업복 느낌.
- 레퍼런스 반영: `assets/generated/yonggang-mascot.png`.

## 티어 흐름
1. 철광석
2. 석탄
3. 코크스
4. 고로 제선공정
5. 용선·쇳물 운반
6. 전로 제강공정
7. 연속주조·반제품
8. 열연코일
9. 냉연·도금 자동차강판
10. 후판
11. 형강·철근·레일·특수강 대표 제품군
12. 용강

## 철강 제조공정·제품 기준
- 공정 흐름은 고로 일관제철 기준으로 `철광석/석탄 → 코크스 → 고로 제선 → 용선 → 전로 제강 → 연속주조 → 압연/후처리 → 대표 제품` 순서를 따른다.
- 대표 제품군은 현대제철 제품군을 참고해 열연, 냉연·도금/자동차강판, 후판, H형강·철근·레일 등 봉형강, 특수강을 반영한다.
- 아이콘은 각 티어가 공정 장비인지, 반제품인지, 최종 제품군인지 시각적으로 구분되도록 12개 개별 PNG와 4×3 스프라이트 시트로 관리한다.

## 게임플레이
- 같은 티어끼리 충돌하면 다음 티어로 병합된다.
- 최종 목표는 용강 얼굴을 만드는 것이다.
- 물리엔진은 기존보다 높은 반복 계산, 티어별 밀도/마찰/반발 계수를 사용한다.
- 공정 한계선 위에서 안정적으로 오래 정체되면 게임오버가 된다.
- 병합 3회째부터 4회 간격으로 `제철레시피 입력퀴즈`가 뜬다.
- 퀴즈 문제는 제공된 현대제철 조직문화 문구만 사용하며, 같은 문구 안에서도 빈칸 위치를 달리해 19개 variation으로 랜덤 출제한다.
- 퀴즈 중에는 물리 진행과 드롭을 잠시 멈춘다.
- 정답 제한시간은 정답 글자 수 × 3초다. 예: `현대제철` 4글자 → 12초.
- 오답 또는 시간초과 시 즉시 `GAME OVER DEAD`가 되고, 게임오버 화면에 정답이 채워진 전체 문구를 보여준다.

## 업데이트 반영
- 앱 버전은 `data/game-data.js`의 `version` 값을 기준으로 관리한다.
- `index.html`은 `style.css`, `data/game-data.js`, `main.js`와 주요 이미지 자산에 버전 쿼리를 붙여 브라우저 캐시 영향을 줄인다.
- 실행 중인 브라우저는 60초마다 `data/game-data.js`를 `cache: no-store`로 다시 확인한다.
- 새 버전이 발견되면 Cache Storage와 Service Worker 등록을 정리하고, `?v=<새버전>&t=<현재시각>` URL로 자동 새로고침한다.
- 사이드 패널의 `APP <version>` 문구로 현재 적용된 버전과 최신 데이터 적용 상태를 표시한다.

## 점수 체계
- 병합 점수 산식: `roundTo5((2 ** (tierIndex + 1)) * 10 * processMultiplier)`.
- 티어별 점수: 철광석 20, 석탄 40, 코크스 90, 제선공정 200, 쇳물 430, 제강공정 990, 연주·반제품 2,175, 열연강판 4,865, 형강·봉강 10,750, 특수강·내연 24,575, 자동차·가전·건물 56,320, 용강 135,170.
- 제철레시피 정답 보너스: 정답 글자 수 × 100점.

## 데이터베이스
- 기본 DB: Google Sheets.
- 생성된 시트: https://docs.google.com/spreadsheets/d/1bdcRVCFmTrgMUi-CFj28E-AknJjqb8HxHghfyU_XuB8/edit
- Spreadsheet ID: `1bdcRVCFmTrgMUi-CFj28E-AknJjqb8HxHghfyU_XuB8`
- 현재 프런트엔드 스키마: `timestamp, player, score, maxTier, durationMs, mergeCount, quizCorrectCount, quizFailReason`.
- Sheets endpoint가 없을 때는 `localStorage.yonggang:lastResult`에 fallback 저장한다.

## 이미지 자산
- GPT 이미지 생성 사용.
- 생성 파일:
  - `assets/generated/yonggang-mascot.png`
  - `assets/generated/value-chain-sprites.png` — 4×3 공정 정확도 기반 스프라이트 시트
  - `assets/generated/components/01-iron-ore.png` ~ `assets/generated/components/12-yonggang-final.png` — 개별 티어 아이콘
  - `assets/generated/factory-background.png`

## 검증 기준
- 페이지가 로드되고 제목이 `용강 만들기`로 보인다.
- 콘솔 오류가 없다.
- 캔버스 클릭/터치/키보드로 오브젝트가 떨어진다.
- 같은 티어 병합 시 점수와 티어가 증가한다.
- 용강 티어는 캐릭터 이미지로 렌더링된다.
- 게임오버 후 결과가 로컬 또는 Sheets로 기록된다.
- 사이드 패널에 현재 앱 버전과 `최신 데이터 적용됨` 상태가 표시된다.
- 기존 브라우저 세션에서도 새 `data/game-data.js` 버전이 감지되면 자동 새로고침된다.
