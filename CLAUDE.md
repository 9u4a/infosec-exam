# 정보보안기사 실기 학습 사이트 — 프로젝트 지침

정보보안기사 실기 기출문제(1~32회, 532문항) 풀이 + 개인 학습 노트를 모은
정적 웹 사이트. GitHub Pages로 배포하며 PC·모바일 모두에서 사용한다.

## 절대 규칙

1. **`exams/sil/실기/` 의 원본 JSON은 절대 수정하지 않는다.** 시험 문제·정답의 원천.
   메타데이터(영역 분류, 해설, 문제/정답 교체)는 `exams/sil/meta/` 레이어에만 쓴다.
2. 빌드 산출물 `docs/data/bundle.js`·`docs/data/cppg.js` 는 **커밋한다.** GitHub Pages는
   빌드를 돌리지 않으므로 생성물이 저장소에 있어야 한다. 데이터·노트·메타를 고치면
   반드시 `node scripts/build.mjs` 를 다시 돌리고 함께 커밋한다.
3. 외부 런타임 의존성 0. `npm install` 하지 않는다 (이 폴더는 OneDrive 동기화
   대상이라 `node_modules` 가 부담). 서드파티는 `docs/vendor/` 에 단일 파일로
   vendoring 한다.
4. 모든 경로는 **상대경로**. GitHub Pages 프로젝트 페이지(`/<repo>/`)에서
   동작해야 하므로 절대경로(`/app.js`)는 깨진다.

## 디렉토리

시험 트랙별 원본은 `exams/<코드>/` 아래로 모은다(`sil`=정보보안기사 실기, `cppg`=CPPG).
새 시험을 추가할 땐 `exams/<코드>/` 폴더 + `scripts/build.mjs` 에 로더 함수 하나 +
이 문서에 스키마 절 하나만 늘리면 된다(`exams/README.md` 에도 같은 안내).

```
exams/
  sil/
    실기/N회(YYYY-MM-DD)/N.json   원본. { title, data: [{ id, type, question, answer }] }
    meta/N.json                   메타 레이어. 아래 스키마
    notes/<영역>/<슬러그>.md        학습 노트. 프론트매터 + 마크다운
    예상문제/<영역>.json           기사 모의고사용 신규 예상문항 — 아래 별도 섹션
    두음.json                     두문자 암기 정리 — 아래 별도 섹션
  cppg/                         CPPG(개인정보관리사) 트랙 — 아래 별도 섹션
scripts/build.mjs             exams/sil/* → bundle.js · exams/cppg/* → cppg.js
docs/                         GitHub Pages 발행 루트 (Settings→Pages→/docs)
server/                       (선택) 학습기록 동기화 Cloudflare Worker — 아래 별도 섹션
```

## meta/N.json 스키마

```json
{
  "round": 30,
  "date": "2025-11-15",
  "questions": {
    "5": {
      "domain": "시스템보안",
      "explanation": "선택. 마크다운 가능. 없으면 키 생략.",
      "question": "선택. 원본이 paraphrase·재구성본이라 실제 기출 문항 전문으로 교체할 때. plain text.",
      "answer": "선택. 오탈자·형식(빈칸 라벨 등)을 맞춰야 할 때. \"정답\" 접두어는 붙이지 말 것(값만).",
      "supplement": "선택. 이미지 지문 전용. \"![alt](img/rNqM.jpg)\". supplementSrc:\"provided\" 함께.",
      "supplementSrc": "이미지 supplement 에 \"provided\" 로만 사용."
    }
  }
}
```

- `domain` 고정 5값 중 하나 (실기 출제 영역):
  `시스템보안` · `네트워크보안` · `애플리케이션보안` · `정보보안일반` · `정보보안관리및법규`
- 문항 번호(문자열 키)는 원본 `id` 와 일치해야 한다. 빌드가 검증하고 경고한다.
- `explanation` 은 최신 회차(32→22회)부터 단계적으로 채운다. 옛 회차 법규 문항은 「현행/종전 병기 규칙」 적용.
- **`question`/`answer` 교체**: `exams/sil/실기/N회/N.json` 원본이 실제 기출의 paraphrase·재구성본
  (1~12·30~32회)인 경우, 실제 기출을 확보하면 `meta.question` 으로 **문제 본문을 통째로 교체**한다
  (원본은 불변). 코드·로그·HTML·보기가 들어가도 `q.question` 은 `esc()` 로 렌더되므로 **코드펜스 불필요**.
  오탈자 수정·정답 표기 정렬에도 `answer` override 사용.
- **정답 표기**: `renderAnswer()`(app.js) 가 `^정답\s*[:：]?` 접두어를 벗기고 항상 `정답` 라벨을 붙여
  통일 렌더한다. 새 `meta.answer` 는 **값만**(접두어·라벨 없이) 적는다.
- `supplement`: **이미지 지문 전용**(`![alt](img/rNqM.jpg)` + `supplementSrc:"provided"`). 로그·코드·보기는
  `question` 에 합친다. 이미지 파일은 `docs/img/rNqM.jpg` + `docs/sw.js` SHELL 등록.
  `supplementHtml(q)`(app.js) 가 `.supplement`(표식·색 없음)로 렌더.
- 미해결: 2회15·3회12 는 산문 지시문이라 자체 완결(원본 캡처 확보 시 `question` 으로 병합 가능),
  31회5 정답은 문항 형식(①②)이 바뀌어 `① HTTPERR / ② DHCP` 로 잠정 기입 — 검증 필요.

## notes/ 프론트매터

```markdown
---
title: 리눅스 로그 파일
domain: 시스템보안
questions: [1-8, 14-6, 27-5]   # "회차-문항번호" 목록
tags: [로그, lastlog, btmp]
related: [시스템보안/유닉스-시스템-하드닝]   # 선택. 아래 참고
---
본문 마크다운...
```

- 파일 경로의 첫 폴더명이 카테고리, 파일명(확장자 제외)이 슬러그.
- `questions:` 를 빌드가 역인덱싱해 각 기출 문항에 "관련 노트" 링크를 자동 생성. 연결은 **노트 쪽에서만** 관리.
- `related:` 는 **대개 생략**한다 — 빌드(`linkRelated`)가 **문항(기출+예상)을 공유하는 노트끼리
  자동으로 연관**을 만들어 `note.related: [{slug, shared}]` 에 넣고, 노트 상세 하단
  "함께 보면 좋은 노트" 카드로 노출한다. 자동 연관이 0건인 노트에만 `related: [카테고리/슬러그]` 수동 지정(양방향, shared=0).
- **`notes/반복출제/` 카테고리**: 회차만 바꿔 반복 출제된 유형 정리. `SIL_EXTRA_CATS`(build.mjs)에 등록돼
  노트 목록 맨 끝 정렬. 본문 = 핵심 정답 + 함정만(회차별 실제 문항·정답은 앱이 인라인 표시). 앱은
  `reviewItem(q,...)` 지연펼침으로 렌더하고 `repeatNote(q)`/`repeatBadge(q)` 가 🔁 배지를 붙인다.
  현재 60주제·139문항. 재생성은 `scratchpad/repeat_clusters.mjs` → `gen_repeat_notes.mjs` 계열 스크립트.

## 예상문제 (기사 모의고사)

원본과 **완전 별개**인 신규 예상 문항. `exams/sil/예상문제/<영역>.json` = `{ domain, items: [...] }`.

```json
{ "id": "y-sys-001", "type": "단답형",
  "question": "...(마크다운·여러 줄)", "answer": "정답 : ...",
  "explanation": "원리·조문 + 함정", "notes": ["시스템보안/리눅스-유닉스-로그파일"], "tags": ["로그"] }
```
- `id` = `y-<code>-NNN`(sys/net/app/gen/law), 전역 유일, 기출 qid(`r{n}q{n}`)와 충돌 금지 — 빌드가 검증.
- `type` 은 `단답형|서술형|실무형`. `notes` 는 기존 노트 슬러그 배열(예상문제→노트 방향, CPPG와 동일).
  빌드가 `EXAM_DATA.predicted`·`note.predicted` 역인덱스 생성(**커밋 필수**).
- ⚠ AI 작성 **예측 문항 — 실제 출제·정답 보장 안 됨**. 카드·해설·모의고사 화면에 명시.
- 현재 186문항(단답121/서술43/실무22, 시스템34·네트워크42·앱38·일반23·법규49). 집필/병합은
  `scratchpad/pred_add_<code>.json` → `pred_apply_add.mjs` → `pred_merge.mjs`.
- **중복/과유사 금지**: 빌드가 (질문+정답) 트라이그램 유사도 ≥0.45(또는 ≥0.3+공유태그3)면 경고.
  새 문항은 기존과 다른 주제·형식으로. `drawMock` 도 한 회차에 태그 2개+ 겹치는 문항을 배제.

**모의고사** (`#/mock`, 풀기 탭 세그먼트): 예상문제에서 영역·유형 균형 **18문항(단답12·서술4·실무2)**
매번 새로 추출 · 180분 타이머(자동 제출) · **60점 합격**. 자가채점(⭕🔺❌), 실무형은 2문제 중 높은
쪽만 ×16점(2023 배점: 단답3/서술12/실무16). 세션은 `session` 키에 `kind:'mock'`·`durationMin` 으로
영속. `#mkPool`/`drawMock({pool})`: `all`/`unseen`(안 푼 우선)/`seen`(복습, `store.attemptCount(qid)>0`
로 판정). **기출 통계·진도와 분리**(`computeStats()`는 기출만 집계) — 통계 하단에 별도 표시.

## 두음 (두문자 암기)

`exams/sil/두음.json` — 참고자료라 **채점·진도 개념 없음**.

```json
{ "제목": "...", "총_항목_수": 67, "항목들": [
  { "항목": "프로세스 상태", "분류": "시스템보안", "두음": "생준 실대완",
    "내용": ["생성 상태", "준비 상태", ...] }
] }
```
- `분류` 선택(5영역 중 하나, 빌드가 검증). `내용` 은 배열(항목 목록) 또는 문자열(공식·설명) —
  빌드가 `list`/`formula` 로 분기해 `EXAM_DATA.mnemonics` 에 넣는다.
- **`두음` 문자열과 `내용` 항목은 1:1 위치 대응이 아니다**(예: `프메 프주파` ↔ 프로세서/주변장치/
  프로세스/메모리/파일) — 글자별 자동 매핑 금지. 두음은 큰 타일로, 내용은 번호 목록으로 따로 렌더.
- 앱 `route('mnemonics')`(`#/mnemonics`, 하단 탭 📿): 분류 칩·검색 · **🙈 가리고 암기** 토글(`mnBlind`)
  — 카드/`뜻 보기` 버튼으로 개별 공개. `mnemoCard()`·`mnemoHeroHtml()` 헬퍼.

## CPPG 트랙 (개인정보관리사)

같은 사이트 안에 경로로 분리된 두 번째 시험 트랙. 5지선다 객관식 100문항 자동채점.
홈 상단 `[정보보안기사 실기 | CPPG]` 스위처로 전환. 라우트는 전부 `#/cppg/...`,
학습기록은 `localStorage` 의 `cppg` 서브트리에 **완전 분리** 저장.

```
exams/cppg/subjects.json           과목 정의(단일 출처). count/durationMin/passTotal/passPerSubjectPct.
exams/cppg/notes/<과목명>/<슬러그>.md  학습 노트. 프론트매터 title/subject/tags.
exams/cppg/notes/참고자료/<슬러그>.md   참고자료 카테고리(아래). 문제 연결 없음.
exams/cppg/quiz/<과목id>.json       5지선다 문제. { subject, items: [...] }
exams/cppg/자료/*.pdf               시행처·법령 원문 PDF(1차 사료). 법률 감수 근거.
```

- 시험(시행처 CPO포럼): 100문항·120분·총점 60 + 과목별 40% 과락. 출제비율 **20/20/25/20/15(%)**
  — `subjects.json` count 반영. 현재 노트 75(참고자료 10 포함)·문제 800(과목별 160/170/210/160/100).
- **참고자료 카테고리**: `exams/cppg/notes/참고자료/` = `subject: 참고자료`. `CPPG_REF_CATS`(build.mjs)에
  등록돼 `subjects.json` 없이도 통과, `note.ref=true`. **문제·모의고사·통계 범위엔 안 들어감**(그쪽은
  5과목 기준). 문제의 `note` 필드로 가리키는 것만 허용(치트시트 링크 등).

문제 스키마 (`items[]`):
```json
{ "id": "s3-012", "stem": "...", "choices": ["...", "..."], "answer": 3,
  "explain": "마크다운 가능. 오답 선택지가 왜 틀린지까지.",
  "note": "개인정보 라이프사이클 관리/개인정보-파기", "tags": ["파기"], "difficulty": 2 }
```
- `answer` **1-based**. `choices` 2~5개. `id` = `<과목id>-NNN`, 전역 유일.
- `note` 는 CPPG 노트 슬러그. **문제→노트 연결은 문제 쪽에서만** 관리(기사 트랙은 반대 방향 — 문제
  수가 많아서). 빌드가 존재 검증 + 노트에 `note.quiz` 역인덱스. 과목명(=폴더명)은 `subjects.json` 의
  `name` 과 일치 검증.

앱 셸 파일 변경 시 `docs/sw.js` 의 `CACHE` 버전도 올린다 (현재 **v37**, 실기·CPPG 공용).

⚠ 개인정보보호법은 개정이 잦다. 주요 시행일: 2020.8.5 데이터3법 / 2023.9.15 대개정(전송요구권 등
일부 2024.3.15) / 2025.10.31·**2026.7.1 안전성 확보조치 고시 제2026-9호** / **2026.9.11 개정**(과징금
반복·중대 시 전체매출 10%·정액 상한 50억, CPO 이사회 보고, ISMS-P 단계적 의무화) / 2027.7 ISMS-P 대개편.
노트에 조문 번호+기준 시점(`2026-09 기준`)+고시번호 명시. 1차 사료는 `exams/cppg/자료/` PDF.

**현행/종전 병기 규칙** — 개정으로 기출과 현행법이 갈리는 논점은 노트·해설에 둘 다 적는다. **CPPG
뿐 아니라 실기 `exams/sil/notes/정보보안관리및법규/` 에도 동일 적용**(노트 상단 `> 기준 시점: 2026-09 …`
한 줄 + 논점별 현행/종전 2줄). 실기는 출제 당시 기준으로 채점되므로 **옛 회차의 정답 = 종전** 값임을
명시하고 현행은 참고로 둔다:
```
### 인터넷망 차단조치
- **현행(2026-09)**: 위험분석 결과에 따른 자율 시행 (2025.10.31 고시 개정)
- **종전(기출 대비)**: 일평균/직전 3개월 100만명 이상 처리자에 일률 적용 → 옛 기출은 이 기준
```
대표 병기 대상: 위치정보사업(현행 등록제/옛 허가제), 과징금(현행 전체매출3%, 2026.9.11~ 반복·중대
10%·정액50억/옛 관련매출3%), 인터넷망 차단(현행 고시 제6조의2, 위험분석 예외 가능/옛 일률 적용),
접속기록 점검(현행 내부관리계획 자율/기출 관행 답 월1회), 수집·이용 근거(현행 제15조①7호 신설/옛 6호).
문제는 원칙적으로 **현행 기준**으로 채점하되 stem에 "(현행 기준)" 표시 + 해설에 변경 이력.
실기 법규 노트 17개 전부 기준 시점 표기 완료, 구조화 병기는 4개 + 옛 회차 해설 ~10건.

집필 내용은 최종적으로 국가법령정보센터(law.go.kr)·시행처(CPO포럼) 자료로 교차 확인 필요 — 정답 보증 불가.

## 서버 동기화 (선택 · `server/`)

학습 기록을 기기 간에 잇는 아주 작은 백엔드. GitHub Pages는 정적이라 별도 호스팅 필요.

- **`server/worker.js`** — Cloudflare Worker. `POST /login`(공유 암호→HMAC 토큰) · `GET/PUT /state`
  (`{state, baseRev, force?}`, rev 불일치 시 409). KV 키 하나(`state:v1`)에 학습기록 JSON 통째 보관.
  Secret: `PASSPHRASE`·`TOKEN_SECRET`, Var: `ALLOW_ORIGIN`. 배포는 `server/README.md`.
- **프런트엔드**(`docs/app.js` 의 `SYNC`): 로그인 안 하면 `SYNC.on===false` → 기존과 100% 동일하게
  localStorage 만 사용. 로그인 시 부팅에 `pull` → 이후 `store.save()` 마다 4초 디바운스 `push`.
  오프라인이면 로컬로 동작하다 online·visible 이벤트에 재동기화.
- **병합**(`mergeState`): 누적형(`results` attempts·`favorites`·`sessions`, cppg 포함)은 **합집합**
  (attempts 는 `t/g` 로 중복 제거), 스칼라(`settings`·`lastSummary`)는 `_mtime` 최신본. 진행 중
  `session` 은 이 기기 우선. `results[qid].memo`·`.ans` 는 mtime 없어 **"긴 쪽 우선"**(알려진 한계).
- `server/worker.js` 는 **빌드 대상 아님** — `wrangler deploy` 로 별도 배포, `docs/` 에 넣지 말 것.
- 검증: `scratchpad/sync.test.mjs`(Worker 단위 + jsdom 2기기 병합·409 충돌).
- ⚠ 공유 암호라 암호를 아는 사람은 기록을 공유(개인/소그룹용). KV Free 쓰기 1,000/일 — 디바운스로 충분.

## 빌드 & 로컬 확인

```bash
node scripts/build.mjs                       # bundle.js·cppg.js 재생성 (참조 오류 시 경고)
python -m http.server 8080 --directory docs  # http://localhost:8080  (file:// 은 불가)
```

- `docs/index.html` 은 `bundle.js` 만 즉시 로드. **`cppg.js`(약830KB)는 지연 로드** —
  `ensureCppg()` 가 `<script>` 주입, `route('cppg')` 관문이 대기 후 `initCppg()` 로 바인딩.
  `docs/sw.js` SHELL 엔 그대로 둬서(백그라운드 프리캐시) 오프라인·2회차는 캐시 히트.
- 일별 집계 키는 **`dayKey(ts)`**(로컬 `YYYY-MM-DD`) — `toISOString()` 은 UTC 라 KST 새벽이
  전날로 새므로 **집계에 쓰지 않는다**(내보내기 파일명만 예외).

## 배포

`main` 브랜치에 push → GitHub Pages가 `/docs` 를 서빙.
데이터/코드 수정 → `node scripts/build.mjs` → `git add -A && git commit && git push`.

## Git / 커밋 규칙

- **공개 저장소다.** 커밋 메시지·본문·파일에 개인 식별·인프라 정보를 넣지 않는다:
  - AI 세션 링크·`Claude-Session` 트레일러 등 도구 메타데이터 **넣지 않는다**.
  - 개인 배포값(Cloudflare Worker URL·계정 서브도메인, KV 네임스페이스 id, 토큰·암호, 이메일 등) 커밋 금지.
- `server/wrangler.toml` 은 **git 무시**(`server/wrangler.toml.example` 만 추적). 실제 값은 각자 로컬에만.
- `.wrangler/`, `.dev.vars` 도 무시(계정 캐시·시크릿).
- 시크릿(`PASSPHRASE`·`TOKEN_SECRET`)은 저장소에 절대 두지 말고 `wrangler secret put` 으로만.

## 사이트 동작 요약

**하단 탭(실기 7개)**: 홈·풀기·두음·노트·저장·통계·더보기(`index.html` `.tabs[data-track="sil"]`).
`모의고사` 는 `풀기` 상단 세그먼트(`solveSeg()`)로 흡수 — `#/mock` 라우트는 유지, `render()` 의
`SIL_TAB` 매핑으로 `mock→solve`·`note→notes` 탭 활성. `검색` 은 탭 없음 — 홈 상단 검색창
(`#homeSearch`)·더보기 메뉴·`/` 단축키로 진입. **CPPG 는 6탭**(두음 제외 동일 구성), `모의고사` 는
`문제` 세그먼트(`cQuizSeg()`)로, `저장`(`cRoute('saved')`)은 즐겨찾기 목록.

**풀이·채점**: 정답 기본 숨김("정답 보기" 토글, 설정에서 항상 펼침). 자가채점 3단계(⭕🔺❌).
제출 점수는 2023 배점(단답3/서술12/실무16) — **⭕만 만점 가산**, 부분점수 없음. 문제 카드에
`.my-ans` 내 답 입력(`store.setAns`, 디바운스 저장, 세션 중엔 빈칸·복습 문맥엔 프리필) — 정답
펼침은 모범답안(`.a-body`)만, 비교 위젯 없음. 즐겨찾기(★)·문항별 메모. **오늘 복습**(망각곡선):
`reviewDueAt`/`dueQids()` 가 `attempts` 만으로 파생 — `DUE_DAYS={x:[1,3,7,14],m:[3,7,14,30],o:[14,30,60,120]}`
(일), 홈 카드 + `#/solve` 옵션. **D-day**: `settings.examDate` 설정 시 홈에 `examPaceCard`
(미풀이/남은일 → 하루 권장 · `streakDays()` 연속 학습일).

**복습 UI**: 점수 화면 "다시 볼 문항"·저장 탭·노트 상세 전부 `reviewItem(q, grade, opts)` 공용 —
펼치면 먼저 문제만 보이고 `정답·해설 보기 ▼` 를 한 번 더 눌러야 열림(2단계 인출 연습, 읽기 전용).
`route('summary')` 한 곳이 라이브 요약·모의고사 결과·`#/summary/<id>` 전부 처리, 세션 레코드의
`qids`+`grades` 스냅샷으로 재채점해도 지난 점수창 고정. 저장 탭은 즐겨찾기/메모 2-세그먼트.

**노트**: `noteProgress(n)`(읽기 전용, `store.result()` 금지)가 연결 문항 채점 이력 집계 — 목록에
진도 막대 + `#nsort`(기본/취약한 순/연결 많은 순), 상세엔 진도 스트립 + "약한 문항만 풀기". 연관
노트는 빌드(`linkRelated`)가 문항 공유로 자동 생성(`note.related`), 상세 하단 카드로 노출.

**기타**: 문항 직링크 `#/q/<qid>`(세션 안 건드림) · 통합검색 `#/search/<query>`(AND 부분일치,
예상문제 포함) · 지난 풀이 기록 `#/history` · PC 키보드 단축키(`installShortcuts()`: `1`·`2`·`3`
채점/보기, `←`/`→` 이동, `Space` 정답, `f` 즐겨찾기, `/` 검색 — 입력창·한글 조합 중 무반응) +
`:focus-visible`/`aria-*` 접근성. 진행 데이터는 기기별 localStorage, 더보기에서 JSON 내보내기/가져오기.
