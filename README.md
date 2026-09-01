# 정보보안기사 실기 학습 사이트

정보보안기사 실기 기출문제(1~32회, **532문항**) 풀이 + 개인 학습 노트.
프레임워크·빌드 의존성 없는 정적 사이트이며 GitHub Pages로 배포한다. PC·모바일(PWA) 모두 지원.

## 기능

- **풀기**: 회차별 / 영역별 / 유형별 / 오답만 / 애매함만 / 즐겨찾기만 / 안 푼 문항 / 랜덤 범위 선택
- 문제는 기본 **정답 숨김** → "정답 보기" 클릭 시 펼침 (설정에서 항상 펼침 가능)
- **자가채점 3단계**: ⭕ 맞음 / 🔺 애매함 / ❌ 틀림 → 세션 제출 시 요약(영역별 성적, 오답 바로가기)
- **통계**: 총 시도·진도·완주 회차, 문항별 오답 랭킹(`30회 5번 4회 틀림`), 영역·유형·회차별 정답률, 최근 14일 학습량
- **즐겨찾기(★)**, 문제별 메모
- **학습 노트**: `notes/**/*.md` 마크다운, 문제에 연결되면 카드에서 "📎 관련 노트"로 이동
- 진행 데이터는 브라우저 localStorage. 더보기 > 내보내기/가져오기(JSON)로 기기 간 이동

## 구조

```
실기/N회(YYYY-MM-DD)/N.json   원본 기출 (수정 금지)
meta/N.json                   영역 분류 + 해설 (원본과 문항번호로 조인)
notes/<영역>/<슬러그>.md        학습 노트 (프론트매터 + 마크다운)
scripts/build.mjs             실기 + meta + notes → docs/data/bundle.js
docs/                         GitHub Pages 발행 루트
```

자세한 규칙과 스키마는 [`CLAUDE.md`](CLAUDE.md) 참고.

## 로컬 실행

```bash
node scripts/build.mjs                        # 데이터 번들 재생성
python -m http.server 8080 --directory docs   # http://localhost:8080  (file:// 은 불가)
```

같은 Wi-Fi의 폰에서 확인: `http://<PC-IP>:8080` (`ipconfig` 로 IPv4 확인)

## 배포

`main` 브랜치 push → GitHub Pages가 `/docs` 를 서빙.
데이터·노트·코드를 수정하면:

```bash
node scripts/build.mjs
git add -A && git commit -m "..." && git push
```

- 배포 URL: `https://9u4a.github.io/<저장소명>/`
- 앱 셸(html/css/js)을 바꾸면 `docs/sw.js` 의 `CACHE` 버전을 올릴 것 (`bundle.js` 는 네트워크 우선이라 무관)

## 노트 추가하기

`notes/시스템보안/새노트.md` 생성:

```markdown
---
title: 표시 제목
domain: 시스템보안
questions: [1-8, 27-5]   # "회차-문항번호"
tags: [태그1, 태그2]
---
본문 마크다운...
```

`node scripts/build.mjs` 실행 시 `questions:` 를 역인덱싱해 각 문항에 노트 링크가 자동 연결된다.
잘못된 회차/문항 참조는 빌드 경고로 표시된다.
