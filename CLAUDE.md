# 정보보안기사 실기 학습 사이트 — 프로젝트 지침

정보보안기사 실기 기출문제(1~32회, 532문항) 풀이 + 개인 학습 노트를 모은
정적 웹 사이트. GitHub Pages로 배포하며 PC·모바일 모두에서 사용한다.

## 절대 규칙

1. **`실기/` 폴더의 원본 JSON은 절대 수정하지 않는다.** 시험 문제·정답의 원천.
   메타데이터(영역 분류, 해설)는 `meta/` 레이어에만 쓴다.
2. 빌드 산출물 `docs/data/bundle.js` 는 **커밋한다.** GitHub Pages는 빌드를
   돌리지 않으므로 생성물이 저장소에 있어야 한다. 데이터·노트·메타를 고치면
   반드시 `node scripts/build.mjs` 를 다시 돌리고 함께 커밋한다.
3. 외부 런타임 의존성 0. `npm install` 하지 않는다 (이 폴더는 OneDrive 동기화
   대상이라 `node_modules` 가 부담). 서드파티는 `docs/vendor/` 에 단일 파일로
   vendoring 한다.
4. 모든 경로는 **상대경로**. GitHub Pages 프로젝트 페이지(`/<repo>/`)에서
   동작해야 하므로 절대경로(`/app.js`)는 깨진다.

## 디렉토리

```
실기/N회(YYYY-MM-DD)/N.json   원본. { title, data: [{ id, type, question, answer }] }
meta/N.json                   메타 레이어. 아래 스키마
notes/<영역>/<슬러그>.md        학습 노트. 프론트매터 + 마크다운
예상문제/<영역>.json           기사 모의고사용 신규 예상문항 — 아래 별도 섹션
두음.json                     두문자 암기 정리 — 아래 별도 섹션
cppg/                         CPPG(개인정보관리사) 트랙 — 아래 별도 섹션
scripts/build.mjs             실기+meta+notes+예상문제+두음 → bundle.js · cppg/ → cppg.js
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
      "answer": "선택. 문항 형식이 바뀌어 정답 표기도 맞춰야 할 때만.",
      "supplement": "선택. 이미지 지문 전용(로그·코드·보기는 question 에 합칠 것). \"![alt](img/rNqM.jpg)\".",
      "supplementSrc": "선택. supplement 가 실제 기출이면 \"provided\"(표식 없이 문제에 이어 렌더). 생략 = 재구성 캡션."
    }
  }
}
```

- `domain` 고정 5값 중 하나 (실기 출제 영역):
  `시스템보안` · `네트워크보안` · `애플리케이션보안` · `정보보안일반` · `정보보안관리및법규`
- 문항 번호(문자열 키)는 원본 `id` 와 일치해야 한다. 빌드가 검증하고 경고한다.
- `explanation` 은 최신 회차(32→22회)부터 단계적으로 채운다.
- **`question`/`answer` 교체**: `실기/N회/N.json` 원본이 실제 기출의 paraphrase·재구성본인 경우,
  실제 기출을 확보하면 `meta.question` 으로 **문제 본문을 통째로 교체**한다(`실기/` 원본은 불변).
  코드·로그·HTML·보기가 들어가도 `q.question` 은 `esc()` 로 렌더되므로 **코드펜스 불필요**.
  형식이 바뀌어 정답 표기(빈칸 라벨 등)를 맞춰야 하면 `answer` 도 함께.
- `supplement`: 이제 **이미지 지문 전용**(`![alt](img/rNqM.jpg)`). 로그·코드·보기는 `question` 에 합친다.
  - 이미지 파일은 `docs/img/rNqM.jpg` + `docs/sw.js` SHELL 등록. `.supp-body img { max-width:100% }`.
  - `supplementSrc: "provided"` → `.supplement.attached`(표식·색 없음, 문제에 이어 표시).
  - `supplementSrc` 없음 → "🧩 지문 재구성" 캡션(정답 역산 예시, 원본 미확보). 현재 5회14 하나.
  - 헬퍼: `supplementHtml(q)` (app.js) — `questionCard`·`reviewItem` 공용.
- 현황: 문제/정답 교체 39건(29 지문 병합 + 10 문항 교체) · 이미지 지문 1 · 재구성 1[5회14].
  작업 정리 = 루트 `데이터정리_지문보충_작업목록.md`.

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
- `questions:` 를 빌드가 역인덱싱해 각 기출 문항에 "관련 노트" 링크를 자동 생성.
  연결은 **노트 쪽에서만** 관리한다.
- `related:` 는 **대개 생략**한다 — 빌드(`linkRelated`)가 **문항(기출+예상)을 공유하는 노트끼리
  자동으로 연관**을 만들어 `note.related: [{slug, shared}]` 에 넣고, 노트 상세 하단
  "함께 보면 좋은 노트" 카드로 노출한다. 공유 문항이 하나도 없어 자동 연관이 안 잡히는 노트에만
  `related: [카테고리/슬러그]` 로 수동 지정(양방향, shared=0).

### `notes/반복출제/` 카테고리 (2026-09-09)

회차만 바꿔 반복 출제된 유형 정리. `SIL_EXTRA_CATS = ['반복출제']`(build.mjs) 에 등록돼
노트 목록에서 **맨 끝**으로 정렬. domain 은 5영역 중 하나(필터용), `questions:` 는 그 주제를
낸 모든 회차. 본문 = **핵심 정답 + 함정** (회차별 실제 문항·정답은 앱이 인라인 표시하므로 표 불필요).
- 앱: `route('note')` 의 `qBox` 가 `category==='반복출제'` 이면 `.rank-item` 대신
  `reviewItem(q, ...)` 지연펼침으로 렌더 → 회차별 정답 비교. `repeatNote(q)`/`repeatBadge(q)`
  헬퍼가 `q.notes` 의 `반복출제/` 슬러그를 찾아 문항카드·`reviewItem` 에 **🔁 배지** 표시.
  `noteLinksHtml(q)` 는 `반복출제/` 슬러그를 `📎` 목록에서 제외(🔁 와 중복 방지).
- 생성: `scratchpad/repeat_clusters.mjs`(마커+트라이그램 클러스터 분석) →
  `scratchpad/repeat_notes.json`(큐레이션) → `scratchpad/gen_repeat_notes.mjs` 로 `.md` 60개 생성.
  현재 60주제 · 139문항 커버. 추가 시 같은 파이프라인.

## 예상문제 (기사 모의고사)

`실기/` 원본과 **완전 별개**인 신규 예상 문항. 다음 시험 대비 실전 모의고사용.

```
예상문제/<영역>.json   { "domain": "시스템보안", "items": [ ... ] }
```

문항 스키마 (`items[]`):
```json
{ "id": "y-sys-001", "type": "단답형",
  "question": "...(마크다운·여러 줄)", "answer": "정답 : ...",
  "explanation": "원리·조문 + 함정", "notes": ["시스템보안/리눅스-유닉스-로그파일"], "tags": ["로그"] }
```
- `id` = `y-<code>-NNN` (code: `sys/net/app/gen/law`), 전역 유일. 기출 qid(`r{n}q{n}`)와 충돌 금지 — 빌드가 검증.
- `type` 은 `단답형|서술형|실무형`. `domain` 은 파일명 = 5영역 중 하나.
- `notes` 는 `notes/` 의 기존 노트 슬러그 배열. **예상문제 → 노트 방향**(CPPG와 동일). 빌드가 `note.predicted` 역인덱스 생성.
- 빌드 산출물: `bundle.js` 의 `EXAM_DATA.predicted` 배열 (**커밋**). `node scripts/build.mjs` 재실행 필수.
- ⚠ AI가 기출 패턴으로 만든 **예측 문항 — 실제 출제·정답 보장 안 됨**. 카드·해설·모의고사 화면에 명시.
- 현재 규모: **186문항**(단답 121 / 서술 43 / 실무 22 · 시스템34·네트워크42·앱38·일반23·법규49). 모의고사 10회분(회당 12·4·2 = 120·40·20)을 감당하는 풀. 집필·병합은 `scratchpad/pred_add_<code>.json` → `pred_apply_add.mjs`(기존 `pred_<code>.json` 에 append) → `pred_merge.mjs`.
- **중복/과유사 금지**: 빌드가 문항쌍의 (질문+정답) 트라이그램 유사도를 검사해 ≥0.45(또는 ≥0.3 + 공유태그 3개)면 경고. 새 문항은 기존과 다른 **주제·형식**(계산·명령어 해석·로그 분석·사례 판단 등)으로. `drawMock` 은 한 회차에 태그 2개 이상 겹치는 유사 문항이 함께 나오지 않도록 편성.

**모의고사** (`#/mock`): 예상문제에서 영역·유형 균형으로 **18문항(단답 12·서술 4·실무 2)** 매번 새로 추출 · 180분 타이머(종료 시 자동 제출) · **60점 합격**. 필답형이라 **자가채점**(⭕🔺❌), 실무형은 2문제 중 더 높게 채점한 1개만 ×16점. 2023 배점(단답 3/서술 12/실무 16). 세션은 `session` 키에 `kind:'mock'`·`durationMin` 으로 영속. 이력은 `sessions` 의 `kind:'mock'` 항목(`score`·`pass`).
- **출제 범위**(`#mkPool`, `drawMock({pool})`): `all` 전체 / `unseen` **안 푼 예상문제 우선**(유형 정원 부족 시 푼 문항으로 채움) / `seen` **푼 문항만(복습)**. `store.attemptCount(qid)>0` 로 풀이 이력 판정 → 예상문제를 안 겹치게 10회 돌릴 수 있음. 세션 라벨에 ` · 새 문항`/` · 복습` 태그.
**예상문제는 기출 통계·진도율과 분리** — `computeStats()` 는 기출(`QUESTIONS`)만 집계. 예상문제 학습·모의고사 총점 추이는 통계 하단에 별도 표시. '풀기' 범위 셀렉트의 `예상문제` 항목 + 영역/유형 범위의 `예상문제도 포함` 체크박스, 통합검색·노트 상세에도 노출.

## 두음 (두문자 암기)

저장소 루트 `두음.json` — 실기 두문자 암기 정리. 참고자료라 **채점·진도 개념 없음**.

```json
{ "제목": "...", "총_항목_수": 67, "항목들": [
  { "항목": "프로세스 상태", "분류": "시스템보안", "두음": "생준 실대완",
    "내용": ["생성 상태", "준비 상태", ...] }
] }
```
- `분류` 는 선택(5영역 중 하나). 빌드가 값 검증. 없으면 목록에서 "기타" 그룹.
- `내용` 은 **배열**(항목 목록) 또는 **문자열**(공식·설명. HRN·SLE·ALE·잔여위험 등). 빌드가
  `list` / `formula` 로 분기해 `EXAM_DATA.mnemonics` 에 넣는다 (`{id, topic, dueum, cat, list, formula}`).
- **`두음` 문자열과 `내용` 항목은 1:1 위치 대응이 아니다** (예: `프메 프주파` ↔ 프로세서/주변장치/
  프로세스/메모리/파일). 글자별 자동 매핑은 하지 않는다 — `두음` 은 큰 타일로, `내용` 은 번호 목록으로.
- `build.mjs loadMnemonics()` → `bundle.js` 재생성·커밋. 항목 추가 시 `분류` 만 적으면 됨.
- 앱 `route('mnemonics')`(`#/mnemonics`, 하단 탭 📿): 분류 칩 필터(`#/mnemonics/<분류>`) · 검색(항목·두음·뜻) ·
  **🙈 가리고 암기** 토글(`mnBlind`, 모듈 스코프) — 뜻을 숨기고 두음 타일만, 카드/`뜻 보기` 버튼으로 개별 공개.
  `mnemoCard()`·`mnemoHeroHtml()` 헬퍼. 두음 문자열은 공백으로 그룹 분리(`.mn-gap`), 글자당 `.mn-tile`.

## CPPG 트랙 (개인정보관리사)

같은 사이트 안에 경로로 분리된 두 번째 시험 트랙. 5지선다 객관식 100문항 자동채점.
홈 상단 `[정보보안기사 실기 | CPPG]` 스위처로 전환. 라우트는 전부 `#/cppg/...`,
학습기록은 `localStorage` 의 `cppg` 서브트리에 **완전 분리** 저장.

```
cppg/subjects.json           과목 정의(단일 출처). count/durationMin/passTotal/passPerSubjectPct.
                             시행처 공고와 다르면 이 파일만 고치면 앱 전체 반영.
cppg/notes/<과목명>/<슬러그>.md  학습 노트. 프론트매터 title/subject/tags. (기사 노트와 동일 규칙)
cppg/notes/참고자료/<슬러그>.md   참고자료 카테고리(아래). 문제 연결 없음.
cppg/quiz/<과목id>.json       5지선다 문제. { subject, items: [...] }
cppg/자료/*.pdf               시행처·법령 원문 PDF(1차 사료). 법률 감수 근거.
```

- 시험(시행처 CPO포럼): 100문항·120분·총점 60 + 과목별 40% 과락. 출제비율 **20/20/25/20/15(%)** — `subjects.json` count 반영.
- 현재 규모: 노트 75(참고자료 10 포함) · 문제 800 (과목별 160/170/210/160/100).

### 참고자료 카테고리

정리용 노트 전용 카테고리. `cppg/notes/참고자료/` 폴더 = `subject: 참고자료`.
빌드의 `CPPG_REF_CATS = ['참고자료']` 에 등록돼 있어 `subjects.json` 에 없어도 경고 없이 통과,
`note.ref = true` 부여. 노트 목록에서 과목 뒤에 별도 칩으로 노출, "문제 N" 대신 "참고자료" 표기.
**문제(quiz)·모의고사·통계 범위에는 들어가지 않는다** (그쪽은 `subjects.json` 5과목 기준).
문제의 `note` 필드로 참고자료 노트를 가리키는 것은 허용(치트시트 링크 등).

문제 스키마 (`items[]`):
```json
{ "id": "s3-012", "stem": "...", "choices": ["...", "..."], "answer": 3,
  "explain": "마크다운 가능. 오답 선택지가 왜 틀린지까지.",
  "note": "개인정보 라이프사이클 관리/개인정보-파기", "tags": ["파기"], "difficulty": 2 }
```
- `answer` 는 **1-based**. `choices` 2~5개. `id` 는 `<과목id>-NNN`, 전역 유일.
- `note` 는 CPPG 노트 슬러그(폴더명/파일명). **문제→노트 연결은 문제 쪽에서만** 관리
  (기사 트랙은 노트→문항. CPPG는 문제 수가 많아 반대 방향). 빌드가 존재를 검증하고
  노트에 역인덱스(`note.quiz`)를 만든다.
- 과목명 = `cppg/notes/` 하위 폴더명 = `subjects.json` 의 `name`. 빌드가 일치 검증.

빌드 산출물 `docs/data/cppg.js` (`window.CPPG_DATA`) 도 **커밋한다**. `cppg/` 를 고치면
`node scripts/build.mjs` 재실행 → `cppg.js` 함께 커밋. 앱 셸 파일 변경 시 `docs/sw.js` 의
`CACHE` 버전도 올린다 (현재 **v34**, 실기·CPPG 공용).

⚠ 개인정보보호법은 개정이 잦다. 주요 시행일:
2020.8.5 데이터3법 / 2023.9.15 대개정 / 2024.3.15 일부(전송요구권·자동화결정·이동형영상기기) /
2025.10.31 & **2026.7.1 안전성 확보조치 고시 제2026-9호** / **2026.9.11 개정**(과징금 반복·중대 위반 시
전체매출 10%·정액 상한 50억, CPO 이사회 보고·미지정 과태료, ISMS-P 단계적 의무화) / 2027.7 ISMS-P 대개편.
노트에 조문 번호 + 기준 시점(`2026-09 기준`) + 고시번호를 명시한다. 1차 사료는 `cppg/자료/` PDF.

**현행/종전 병기 규칙** — 개정으로 기출과 현행법이 갈리는 논점은 노트·해설에 둘 다 적는다.
**CPPG 트랙뿐 아니라 실기 `notes/정보보안관리및법규/` 에도 동일하게 적용**한다(노트 상단에
`> 기준 시점: 2026-09 …` 한 줄 + 논점별 현행/종전 2줄). 실기는 출제 당시 기준으로 채점되므로
**옛 회차의 정답 = 종전** 값임을 명시하고 현행은 참고로 둔다:
```
### 인터넷망 차단조치
- **현행(2026-09)**: 위험분석 결과에 따른 자율 시행 (2025.10.31 고시 개정)
- **종전(기출 대비)**: 일평균/직전 3개월 100만명 이상 처리자에 일률 적용 → 옛 기출은 이 기준
```
대표 병기 대상: 위치정보사업(현행 등록제 / 옛 허가제), 과징금(현행 전체매출 3% / 2026.9.11~ 반복·중대 10%·정액 50억 / 옛 관련매출 3%),
인터넷망 차단(현행 고시 제6조의2 — 100만명 대상 유지, 다운로드·파기 취급자만 위험분석으로 예외 가능 / 옛 일률 적용),
접속기록 점검(현행 고시 제2026-9호 — 주기·방법을 내부관리계획으로 자율 설정 / 기출 관행 답은 월 1회),
수집·이용 법적 근거(현행 제15조① **7호** — 공중위생 추가 / 옛 6호), 목적 외 제공(제18조② 5~9호는 공공기관만).
문제는 원칙적으로 **현행 기준**으로 채점하되 stem에 "(현행 기준)" 등을 표시하고 해설에 변경 이력을 쓴다.

집필 내용은 최종적으로 국가법령정보센터(law.go.kr) 현행 조문·시행처(CPO포럼) 자료로 교차 확인 필요 — 정답 보증 불가.

## 서버 동기화 (선택 · `server/`)

학습 기록을 기기 간에 잇기 위한 **아주 작은 백엔드**. GitHub Pages는 정적이라 별도 호스팅 필요.

- **`server/worker.js`** — Cloudflare Worker. `POST /login`(공유 암호 → HMAC 서명 토큰) · `GET /state` · `PUT /state`(`{state, baseRev, force?}`, rev 불일치 시 409). KV 키 하나(`state:v1`)에 학습기록 JSON 통째로 보관. Secret: `PASSPHRASE`·`TOKEN_SECRET`, Var: `ALLOW_ORIGIN`. 배포는 `server/README.md`.
- **프런트엔드(`docs/app.js` 의 `SYNC` 객체)**: 로그인 안 하면 `SYNC.on===false` → **기존과 100% 동일하게 localStorage 로만 동작**. 로그인 시 부팅에 `pull`(서버 상태 병합) → 이후 `store.save()` 마다 4초 디바운스 `push`. 오프라인이면 로컬로 동작하다 online·visible 이벤트에 재동기화.
- **병합**(`mergeState`): 누적형(`results` attempts·`favorites`·`sessions`, cppg 포함)은 **합집합**(attempts 는 `t/g` 로 중복 제거), 스칼라(`settings`·`lastSummary`)는 `_mtime` 최신본. 진행 중 `session` 은 이 기기 우선. → 2기기 동시 사용해도 데이터 유실 최소, 충돌은 last-write-wins.
  - `results[qid].memo` 는 문항별 mtime 이 없어 **"긴 쪽 우선"** 병합 — 편집으로 줄이면 짧은 쪽이 질 수 있음(알려진 한계).
- `store.save()` 가 `_mtime` 갱신 + `SYNC.schedulePush()`. `save({fromSync:true})` 는 둘 다 건너뜀(병합 반영 시).
- `server/worker.js` 는 **빌드 대상 아님** — GitHub Pages 와 무관, 사용자가 `wrangler deploy` 로 별도 배포. `docs/` 에 넣지 말 것.
- 검증: `scratchpad/sync.test.mjs` (Worker 단위 + jsdom 2기기 병합·409 충돌).

⚠ 공유 암호 방식이라 암호를 아는 사람은 같은 기록을 공유한다(개인/소그룹용). KV Free 쓰기 한도 1,000/일 — 디바운스+무변경 skip 으로 충분하나 초과 시 D1 로 이전.

## 빌드 & 로컬 확인

```bash
node scripts/build.mjs                       # bundle.js 재생성 (참조 오류 시 경고)
python -m http.server 8080 --directory docs  # http://localhost:8080  (file:// 은 불가)
```

- `docs/index.html` 은 `bundle.js` 만 즉시 로드한다. **`cppg.js`(약 830KB)는 지연 로드** —
  `app.js` 의 `ensureCppg()` 가 `<script>` 를 주입하고 `route('cppg')` 관문이 이를 기다렸다가
  `initCppg()` 로 CPPG 바인딩(`CPPG`·`CQ`·`CQ_BY_ID`·`CSUBJ`·`CSUBJ_BY_ID`·`CNOTE_BY_SLUG`·`CCFG`, 전부 `let`)을 채운다.
  `docs/sw.js` SHELL 에는 `cppg.js` 를 **그대로 둔다**(SW 가 백그라운드 프리캐시 → 오프라인·2회차는 캐시 히트).
- 일별 학습량 집계 키는 **`dayKey(ts)`**(로컬 `YYYY-MM-DD`), 표시는 `fmtDay`/`fmtWhen`.
  `toISOString()` 은 UTC 라 KST 새벽이 전날로 새므로 **집계에 쓰지 않는다**(내보내기 파일명만 예외).

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

- **하단 탭(실기 7개)**: 홈 · 풀기 · 두음 · 노트 · 저장 · 통계 · 더보기 (`index.html` `.tabs[data-track="sil"]`).
  - `모의고사` 는 `풀기` 페이지 상단 세그먼트 `[문제 풀기 | 모의고사]`(`solveSeg()`)로 흡수 — `#/mock` 라우트는
    유지(홈 링크·이어풀기 호환), `render()` 의 `SIL_TAB` 매핑으로 `mock→solve`(풀기 탭), `note→notes`(노트 탭) 활성.
  - `검색` 은 탭바에서 빠짐 — **홈 상단 검색창**(`#homeSearch`, submit → `#/search/<q>`) + `더보기` `.menu-row` + `/` 단축키. `#/search` 라우트는 그대로(탭 활성 없음).
- 문제는 기본적으로 **정답 숨김**. "정답 보기" 토글(다시 접기 가능). 설정에서 항상 펼침 토글.
- 자가채점 3단계: ⭕맞음 / 🔺애매함 / ❌틀림 → localStorage 누적.
- 제출(summary) 자가채점 점수: 2023 배점(단답 3 / 서술 12 / 실무 16점). **⭕로 채점한 문항만 만점 가산**(유형 무관, 부분점수 없음), 🔺·❌는 0점. 유형별 breakdown + "애매함까지 정답 시 최대점" 표시.
- 통계: 문항별 오답 횟수 랭킹, 회차·영역·유형별 정답률, 회독 수.
- 즐겨찾기(★), 오답만/애매함만/즐겨찾기만 필터로 재풀이.
- 정답 카드는 **모범답안(`.a-body`) + 해설 + 관련 노트 + 채점 버튼 + 메모** 만 표시(내 답 입력·비교 기능 없음).
- **오늘 복습할 문항**(망각곡선): `reviewDueAt(qid)`/`dueQids()` 가 `attempts` 만으로 파생(저장·동기화 변경 없음).
  마지막 채점 등급 × 연속 횟수로 재복습 간격 결정 — `DUE_DAYS = { x:[1,3,7,14], m:[3,7,14,30], o:[14,30,60,120] }`(일).
  홈에 `🔁 오늘 복습할 문항 N` 카드(상위 20문항 `startSession`), `#/solve` 범위에 `오늘 복습` 옵션. 기출만 대상.
- **시험 대비**: `settings.examDate`(실기)·`settings.cppgExamDate`(CPPG) — 더보기 설정의 `<input type=date>`.
  설정 시 홈에 `examPaceCard` — `D-N` · 미풀이/남은일 → 하루 권장 문항 · 오늘 진행 막대 · `streakDays()` 연속 학습일.
- **키보드 단축키**(PC, `installShortcuts()` 부팅 1회 등록 · `min-width:900px` 에서 더보기에 안내):
  `1`·`2`·`3` 채점(맞음·애매·틀림) 또는 객관식 보기 · `←`/`→` 이전·다음(점프 그리드 있는 세션 화면만) ·
  `Space` 정답 펼치기 · `f` 즐겨찾기 · `/` 검색 · `?` 도움말. 입력창 포커스·한글 조합 중엔 무반응.
  접근성: `.grade-row .btn`·`.star` `aria-pressed`, `.reveal-btn` `aria-expanded`, `.q-cell`·탭 `aria-current`,
  전역 `:focus-visible` 아웃라인.
- **저장 탭** `#/saved`(하단 탭 ⭐): 즐겨찾기 / 메모 2-세그먼트. 두 목록 모두 `reviewItem` 펼침 행 —
  눌러서 정답·해설을 인라인 확인하고, `opts.memo` 로 **목록에서 메모를 바로 수정**(변경 시 저장·동기화).
  즐겨찾기 쪽엔 "N문항 풀기", 공통으로 "모두 펼치기" 토글. `더보기` 안에 있던 즐겨찾기·메모 섹션을
  이리로 옮겼고, `더보기` 상단엔 검색·저장·지난 기록·통계로 가는 `.menu-row` 바로가기.
- **이어풀기**: 진행 중 세션은 localStorage(`session` 키)에 저장 → 앱 재실행·새로고침해도 홈의 "이어풀기" 카드로 재개. `finishSession()` 시 결과를 `lastSummary` 로 옮기고 세션 비움. 세션 화면에 문항 점프 그리드.
  - `startSession()` 이 **진행 중이던 세션을 버릴 때, 모의고사이거나 채점 흔적이 있으면 `recordCurrentSession()` 으로 `sessions` 에 기록**한다(중단해도 홈 "최근 모의고사"·지난 기록에 남음). `finishSession()` 도 이 함수를 재사용.
  - 홈 "최근 모의고사" 카드: 응시 횟수 · 최신 점수/합격 · **상대 시각(`fmtWhen`)** · 직전 점수들. 날짜는 `toISOString`(UTC) 대신 로컬 기준 `fmtDay`/`fmtWhen` 사용(밤 시간대 하루 어긋남 방지).
- **점수 화면 "다시 볼 문항"**: 오답·애매·미채점 문항을 `<details class="q-review">` 로 나열 → 헬퍼 `reviewItem(q, grade, opts)`. 펼치면 **먼저 문제(+지문·메모)만** 보이고, `정답·해설 보기 ▼` 를 한 번 더 눌러야 정답·해설·관련노트가 열린다(2단계 인출 연습, 읽기 전용, 지연 빌드). `settings.alwaysShowAnswer` 켜져 있으면 자동 펼침. `opts.memo`(편집 textarea)·`opts.summaryText`(요약줄 대체)·`opts.hideRepeatBadge`. "모두 펼치기"(details 만 열림) + "이 문항만 크게 보기" 링크. `route('summary')` 한 곳 → 라이브 요약·모의고사 결과·`#/summary/<id>` 모두 적용. 저장 탭·노트 상세의 펼침 행도 동일.
- **노트 상세**의 "연결된 기출 문항"·"관련 예상문제" 목록도 `reviewItem` 펼침 행(카테고리 무관) — 노트 안에서 답·해설 바로 확인 + "모두 펼치기" + "모두 풀기".
- **노트 학습 진도**: `noteProgress(n)`(읽기 전용 — `store.lastGrade` 만, `store.result()` 금지)가 연결 문항(기출+예상)의 채점 이력을 집계.
  - 노트 목록: 항목마다 `연결 N (기출·예상)` + 풀이 수·정답률 + 진도 막대(`barTrack`). `#nsort` 셀렉트 — `기본순`/`취약한 순`(`weak` 가중치 = 오답2·애매1·미풀이0.5)/`연결 많은 순`. 전역 정렬 시 카테고리 그룹 헤더 없이 평평하게. 선택값은 모듈 스코프 `noteSort` 에 기억(해시 미반영).
  - 노트 상세: 제목 아래 진도 스트립(`📊 연결 N · M 풀이 · 정답 %`) + "약한 문항만 풀기"(마지막 채점 ❌·🔺·미풀이 id 로 `startSession`).
- **연관 노트**: 빌드가 문항 공유로 `note.related` 자동 생성(수동 `related:` 프론트매터는 자동 0건일 때만). 노트 상세 하단 "함께 보면 좋은 노트" 카드 — `🔁`(반복출제)/`📎` 칩 + 공유 문항 수.
- **지난 풀이 기록** `#/history`: 제출한 세션 목록(홈·더보기·요약 화면에서 진입). 각 항목 클릭 → `#/summary/<id>` 로 **그때 점수창을 그대로 다시 표시**. `finishSession()` 이 세션 레코드에 `qids` + `grades`(qid→⭕🔺❌) 스냅샷을 남기므로, 이후 같은 문항을 다르게 재채점해도 지난 점수창은 고정. 모의고사 이력 항목도 같은 방식으로 결과 재열람.
- **문항 직링크** `#/q/<qid>`: 통계·즐겨찾기·노트·검색의 단일 문항 클릭은 세션을 건드리지 않고 이 라우트로 이동. 같은 회차 이전/다음 이동.
- **통합 검색** `#/search/<query>`(탭 아님 — 홈 상단 `#homeSearch` 검색창·더보기 메뉴·`/` 단축키로 진입): 문제·정답·해설·보충지문·노트 전체를 AND 부분일치로 검색(예상문제 포함). 결과에서 바로 세션 시작 가능. 입력은 `history.replaceState` 로 URL 동기화.
- **모의고사** `#/mock`(풀기 탭 세그먼트): 예상문제 18문항 실전 편성 + 180분 타이머 + 60점 합격 판정. 위 「예상문제」 섹션 참고. 세션 인프라(`route('session')`/`route('summary')`)를 재사용하며 `SESSION.kind==='mock'`·`durationMin` 으로 타이머·합격배너 분기.
- **두음** `#/mnemonics`(하단 탭 📿): 위 「두음」 섹션 참고. 분류 칩 필터 · 검색 · 🙈 가리고 암기 토글. `mnemoCard()`.
- 진행 데이터는 기기별 localStorage. 더보기 > 내보내기/가져오기(JSON)로 기기 간 이동. 앱 셸(index.html/style.css/app.js/sw.js) 변경 시 `docs/sw.js` `CACHE` 버전을 올린다 (현재 **v34**).
- **CPPG 트랙**: 하단 탭 **6개** — 홈 · 문제 · 노트 · 저장 · 통계 · 더보기 (실기와 같은 구성, 두음만 없음).
  - `모의고사` 는 `문제` 페이지 상단 세그먼트 `[연습문제 | 모의고사]`(`cQuizSeg()`, `.track-switch.sub-seg`)로 흡수.
    `#/cppg/mock` 라우트 유지. `render()` 의 `CPPG_TAB` 매핑으로 `mock→quiz`(문제 탭), `note→notes`(노트 탭) 활성.
  - `저장`(`cRoute('saved')`, `#/cppg/saved`) — 즐겨찾기 문제 목록 + "N문항 풀기". `더보기` 에 있던 즐겨찾기 섹션을
    이리로 옮기고, `더보기` 상단엔 저장·노트·통계 `.menu-row` 바로가기.
  - 연습문제 범위(과목/노트/태그/오답/즐겨찾기/안 푼/랜덤, 즉시 공개 토글). 과목/노트/태그 범위엔 **"안 푼 문제만"**
    체크박스(`#conlyunseen`) + 하위 셀렉트에 `안 푼 N/전체 M` 카운트.
  - 모의고사: 과목별 배분 100문항 + 120분 타이머 + 총점 60·과목별 40% 과락. 연습·모의 세션 모두 `cppg.session` 에
    영속(타이머 포함 복원). 마지막 트랙을 `settings.track` 에 저장해 다음 실행 시 그 트랙 홈으로 부팅.
