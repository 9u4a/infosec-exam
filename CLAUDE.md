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
scripts/build.mjs             실기 + meta + notes → docs/data/bundle.js
docs/                         GitHub Pages 발행 루트 (Settings→Pages→/docs)
```

## meta/N.json 스키마

```json
{
  "round": 30,
  "date": "2025-11-15",
  "questions": {
    "5": {
      "domain": "시스템보안",
      "explanation": "선택. 마크다운 가능. 없으면 키 생략."
    }
  }
}
```

- `domain` 고정 5값 중 하나 (실기 출제 영역):
  `시스템보안` · `네트워크보안` · `애플리케이션보안` · `정보보안일반` · `정보보안관리및법규`
- 문항 번호(문자열 키)는 원본 `id` 와 일치해야 한다. 빌드가 검증하고 경고한다.
- `explanation` 은 최신 회차(32→22회)부터 단계적으로 채운다.

## notes/ 프론트매터

```markdown
---
title: 리눅스 로그 파일
domain: 시스템보안
questions: [1-8, 14-6, 27-5]   # "회차-문항번호" 목록
tags: [로그, lastlog, btmp]
---
본문 마크다운...
```

- 파일 경로의 첫 폴더명이 카테고리, 파일명(확장자 제외)이 슬러그.
- `questions:` 를 빌드가 역인덱싱해 각 기출 문항에 "관련 노트" 링크를 자동 생성.
  연결은 **노트 쪽에서만** 관리한다.

## 빌드 & 로컬 확인

```bash
node scripts/build.mjs                       # bundle.js 재생성 (참조 오류 시 경고)
python -m http.server 8080 --directory docs  # http://localhost:8080  (file:// 은 불가)
```

## 배포

`main` 브랜치에 push → GitHub Pages가 `/docs` 를 서빙.
데이터/코드 수정 → `node scripts/build.mjs` → `git add -A && git commit && git push`.

## 사이트 동작 요약

- 문제는 기본적으로 **정답 숨김**. "정답 보기" 클릭 시 펼침. 설정에서 항상 펼침 토글.
- 자가채점 3단계: ⭕맞음 / 🔺애매함 / ❌틀림 → localStorage 누적.
- 통계: 문항별 오답 횟수 랭킹, 회차·영역·유형별 정답률, 회독 수.
- 즐겨찾기(★), 오답만/애매함만/즐겨찾기만 필터로 재풀이.
- 진행 데이터는 기기별 localStorage. 더보기 > 내보내기/가져오기(JSON)로 기기 간 이동.
