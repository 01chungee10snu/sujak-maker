window.YONGGANG_GAME_DATA = {
  name: '용강 만들기',
  version: '2.4.0-leaderboard',
  physics: {
    radiusPolicy: 'strictly-increasing-tier-radius',
    massPolicy: 'strictly-increasing-nominal-mass',
    renderScale: 1,
    note: '각 티어의 radius를 Matter.js 원형 충돌 반경과 캔버스 스프라이트 표시 반경의 단일 기준으로 사용하며, radius² × density 기준 명목 질량도 티어 순서대로 증가한다.'
  },
  googleSheets: {
    mode: 'web-app-or-local-fallback',
    spreadsheetId: '1bdcRVCFmTrgMUi-CFj28E-AknJjqb8HxHghfyU_XuB8',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1bdcRVCFmTrgMUi-CFj28E-AknJjqb8HxHghfyU_XuB8/edit',
    endpoint: 'https://script.google.com/macros/s/AKfycbys1T0PPHSto6Bp7V0NbNn4ulFD7-LcM6ammbWvNzCADsoPPx0lzD5Mn_HpsnhRxDet/exec',
    schema: ['timestamp', 'nickname', 'employeeId', 'startScore', 'endScore', 'maxTier', 'durationMs', 'mergeCount', 'quizCorrectCount', 'quizFailReason']
  },
  scoring: {
    rule: 'roundTo5((2 ** (tierIndex + 1)) * 10 * processMultiplier)',
    note: '병합 깊이가 올라갈수록 필요 조합 수가 2배로 늘어나므로 기하급수 기본점수에 공정 가중치를 적용한다.'
  },
  tiers: [
    { id: 'iron_ore', name: '철광석', stage: '원료', radius: 18, score: 20, color: '#8f4f35', edge: '#4d2d28', density: 0.0018, restitution: 0.18, friction: 0.76, icon: '⛏️', desc: '제철 밸류체인의 출발점입니다.', detailDesc: '지각에 널리 분포된 산화철 광물로, 제선 공정의 원료입니다.', wikiLink: 'https://ko.wikipedia.org/wiki/%EC%B2%A0%EA%B4%91%EC%86%8C' },
    { id: 'coal', name: '석탄', stage: '원료', radius: 22, score: 40, color: '#2b2d35', edge: '#101218', density: 0.00155, restitution: 0.16, friction: 0.82, icon: '◼', desc: '열과 환원력을 제공하는 원료입니다.', detailDesc: '고온에서 코크스로 가공되거나 직접 열원으로 쓰이는 유기 퇴적암입니다.', wikiLink: 'https://ko.wikipedia.org/wiki/%EC%84%9D%ED%83%84' },
    { id: 'coke', name: '코크스', stage: '원료 전처리', radius: 28, score: 90, color: '#56515a', edge: '#1f2228', density: 0.00145, restitution: 0.20, friction: 0.74, icon: '◆', desc: '석탄을 가공해 만든 고로용 연료입니다.', detailDesc: '석탄을 고온에서 탈휘소시켜 만든 다공성 고체 연료로, 고로의 주요 환원제입니다.', wikiLink: 'https://ko.wikipedia.org/wiki/%EC%BD%94%ED%81%AC%EC%8A%A4' },
    { id: 'blast_furnace', name: '고로 제선', stage: '제선', radius: 35, score: 200, color: '#d25a2c', edge: '#74301f', density: 0.0019, restitution: 0.12, friction: 0.84, icon: '炉', desc: '고로에서 철광석과 코크스로 용선을 만듭니다.', detailDesc: '고온에서 철광석을 환원해 액체 상태의 용선을 생산하는 핵심 설비입니다.', wikiLink: 'https://ko.wikipedia.org/wiki/%EA%B3%A0%EB%A1%9C' },
    { id: 'pig_iron', name: '용선 운반', stage: '용선', radius: 43, score: 430, color: '#ff7b24', edge: '#9d330e', density: 0.0022, restitution: 0.10, friction: 0.70, icon: '●', desc: '고로에서 나온 뜨거운 쇳물을 래들로 운반합니다.', detailDesc: '고로에서 생산된 용선을 래들로 운반하며, 탄소 함량이 높아 바로 강으로 쓰기 어렵습니다.', wikiLink: 'https://ko.wikipedia.org/wiki/%EC%9A%A9%EC%84%A0' },
    { id: 'steelmaking', name: '전로 제강', stage: '정련', radius: 52, score: 990, color: '#ffb13b', edge: '#c46b00', density: 0.00205, restitution: 0.11, friction: 0.72, icon: '⚙', desc: '전로 산소취련으로 불순물을 줄이고 강 성분을 조정합니다.', detailDesc: '용선의 불순물을 산소 분사로 제거하고 성분을 조정해 강으로 만드는 공정입니다.', wikiLink: 'https://ko.wikipedia.org/wiki/%EC%A0%84%EB%A1%9C' },
    { id: 'casting', name: '연속주조', stage: '주조', radius: 62, score: 2175, color: '#b9c5cf', edge: '#61717e', density: 0.0023, restitution: 0.15, friction: 0.68, icon: '▰', desc: '슬래브·블룸·빌릿 같은 반제품으로 굳힙니다.', detailDesc: '액화된 강을 연속적으로 냉각·응고시켜 슬래브, 블룸, 빌릿 등으로 만듭니다.', wikiLink: 'https://ko.wikipedia.org/wiki/%EC%97%B0%EC%86%8D%EC%A3%BC%EC%A0%84' },
    { id: 'hot_rolled', name: '열연코일', stage: '압연', radius: 73, score: 4865, color: '#6f8fa8', edge: '#344b5c', density: 0.0026, restitution: 0.13, friction: 0.66, icon: '▭', desc: '뜨겁게 압연해 코일 형태의 열연강판을 만듭니다.', detailDesc: '고온에서 압연한 후 코일로 감은 강판으로, 구조용·산업용으로 널리 쓰입니다.', wikiLink: 'https://ko.wikipedia.org/wiki/%EC%97%AD%EC%97%B0%EA%B0%95' },
    { id: 'cold_auto_sheet', name: '냉연·차강판', stage: '후처리', radius: 86, score: 10750, color: '#8796a3', edge: '#44515b', density: 0.00285, restitution: 0.12, friction: 0.70, icon: '▤', desc: '냉연·도금 공정을 거쳐 자동차와 가전에 쓰이는 고품질 강판이 됩니다.', detailDesc: '열연강판을 냉간 압연·도금한 고품질 강판으로, 자동차와 가전에 핵심 소재입니다.', wikiLink: 'https://ko.wikipedia.org/wiki/%EB%83%89%EC%97%B4%EA%B0%95' },
    { id: 'heavy_plate', name: '후판', stage: '제품군', radius: 101, score: 24575, color: '#4b6f98', edge: '#243b55', density: 0.0030, restitution: 0.10, friction: 0.75, icon: '▱', desc: '조선·에너지·구조물에 쓰이는 두꺼운 강판입니다.', detailDesc: '두께가 큰 강판으로 조선, 발전소, 건설 구조물 등에 사용됩니다.', wikiLink: 'https://ko.wikipedia.org/wiki/%ED%9B%84%ED%8C%90' },
    { id: 'long_special_products', name: '봉형·특수강', stage: '대표 제품', radius: 116, score: 56320, color: '#2f89c5', edge: '#104766', density: 0.00315, restitution: 0.09, friction: 0.78, icon: 'H', desc: 'H형강·철근·레일과 자동차·기계용 특수강을 대표합니다.', detailDesc: 'H형강, 철근, 레일 등 건설·인프라용과 자동차·기계용 특수강을 포함합니다.', wikiLink: 'https://ko.wikipedia.org/wiki/%ED%8A%B8%EC%88%98%EA%B0%95' },
    { id: 'yonggang', name: '용강', stage: '최종 생물', radius: 132, score: 135170, color: '#ffbd3f', edge: '#18347a', density: 0.0033, restitution: 0.08, friction: 0.82, icon: '☺', desc: '제철 밸류체인의 흐름으로 태어난 생물입니다.', detailDesc: '제철 밸류체인의 여러 공정과 제품을 머지하며 성장하는 게임의 주인공입니다.', wikiLink: '' }
  ],
  recipeQuiz: {
    triggerEveryMerges: 4,
    firstTriggerMerge: 3,
    secondsPerCharacter: 2.5,
    correctBonusPerCharacter: 100,
    failTitle: 'GAME OVER DEAD',
    failMessage: '제철 레시피 입력퀴즈 실패. 같은 편의 안전·협업 레시피를 다시 익히십시오.'
  },
  recipeQuizzes: [
    { prompt: '업무지시는 ____하게, 회의는 간결하게.', answer: '명확', timeLimitSeconds: 6 },
    { prompt: '업무지시는 명확하게, 회의는 ____하게.', answer: '간결', timeLimitSeconds: 6 },
    { prompt: '질문은 ____롭게 해요.', answer: '자유', timeLimitSeconds: 6 },
    { prompt: '어려운 일 ____?', answer: '있어요', timeLimitSeconds: 9 },
    { prompt: '말 한마디가 우리____를 바꿔요.', answer: '문화', timeLimitSeconds: 6 },
    { prompt: '교육은 서로를 든든한 업무파트너로 만드는 지름길, ____해요.', answer: '적극권장', timeLimitSeconds: 12 },
    { prompt: '교육은 서로를 든든한 업무____로 만드는 지름길, 적극 권장해요.', answer: '파트너', timeLimitSeconds: 9 },
    { prompt: '보고 또 봐도\n그 ____예요.', answer: '보고', timeLimitSeconds: 6 },
    { prompt: '근무는 ____하게. 업무는 확실하게 해내요.', answer: '유연', timeLimitSeconds: 6 },
    { prompt: '근무는 유연하게. 업무는 ____하게 해내요.', answer: '확실', timeLimitSeconds: 6 },
    { prompt: '쏘지 마세요. 같은 ____이에요.', answer: '편', timeLimitSeconds: 3 },
    { prompt: '우리의 조직은 팀이 아니라 \'____\'이에요.', answer: '현대제철', timeLimitSeconds: 12 },
    { prompt: '문제 발생시 네 탓 보단 ____과 대안마련으로 함께 해결해요.', answer: '문제인식', timeLimitSeconds: 12 },
    { prompt: '문제 발생시 네 탓 보단 문제인식과 ____으로 함께 해결해요.', answer: '대안마련', timeLimitSeconds: 12 },
    { prompt: '안전만큼은 ____과 참여가 항상 참이에요.', answer: '참견', timeLimitSeconds: 6 },
    { prompt: '안전만큼은 참견과 ____가 항상 참이에요.', answer: '참여', timeLimitSeconds: 6 },
    { prompt: '____, 우리 모두의 역할이에요.', answer: '솔선수범', timeLimitSeconds: 12 },
    { prompt: '과거 해오던 방식은 ____만 하세요. 새로운 접근은 변화의 시작이에요.', answer: '참고', timeLimitSeconds: 6 },
    { prompt: '과거 해오던 방식은 참고만 하세요. 새로운 접근은 ____의 시작이에요.', answer: '변화', timeLimitSeconds: 6 }
  ]
};
