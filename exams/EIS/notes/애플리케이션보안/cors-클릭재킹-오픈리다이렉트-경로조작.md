---
title: SOP·CORS · 클릭재킹 · 오픈 리다이렉트 · 경로 조작
domain: 애플리케이션보안
questions: []
tags: [SOP, CORS, 클릭재킹, X-Frame-Options, CSP, frame-ancestors, 오픈리다이렉트, 경로조작, PathTraversal]
related: [애플리케이션보안/xss-csrf, 애플리케이션보안/인젝션-웹셸-요청위조-스머글링, 애플리케이션보안/owasp-top10과-시큐어-sdlc]
---

> 기준 시점: 2026-09 · OWASP Top 10:2021 · 행정안전부 「소프트웨어 보안약점 진단가이드」.

## 한 줄 정의

브라우저는 **동일 출처 정책(SOP)** 으로 사이트끼리 서로의 데이터를 읽지 못하게 막는다. **CORS** 는 이 벽에 문을 내는 설정이라 잘못 열면 데이터가 샌다. **클릭재킹·오픈 리다이렉트**는 사용자를 속여 클릭·이동시키고, **경로 조작**은 서버 파일 경로를 `../` 로 벗어나게 한다.

## SOP (Same-Origin Policy)

**출처(Origin) = 스킴 + 호스트 + 포트**. 셋 중 하나라도 다르면 다른 출처다.

| 비교 대상 (기준 `https://a.com`) | 같은 출처? | 이유 |
|---|---|---|
| `https://a.com/x/y` | O | 경로는 무관 |
| `http://a.com` | X | 스킴 다름 |
| `https://a.com:8443` | X | 포트 다름 |
| `https://www.a.com` | X | 호스트 다름 |

- SOP 가 막는 것: 다른 출처 응답을 **스크립트로 읽기**
- 막지 않는 것: `<img>`·`<script>`·폼 전송 등 **요청 보내기** → 그래서 CSRF 가 가능하다

## CORS (Cross-Origin Resource Sharing)

서버가 **응답 헤더**로 "이 출처는 내 응답을 읽어도 된다" 고 허락한다.

| 헤더 | 의미 |
|---|---|
| `Access-Control-Allow-Origin` | 허용 출처 (`https://b.com` 또는 `*`) |
| `Access-Control-Allow-Credentials: true` | 쿠키 포함 요청 허용 |
| `Access-Control-Allow-Methods / -Headers` | 허용 메서드·헤더 |

- 단순 요청이 아니면(PUT·DELETE, 사용자 정의 헤더 등) 브라우저가 먼저 **OPTIONS 프리플라이트**를 보낸다

| 취약 설정 | 위험 |
|---|---|
| 요청의 `Origin` 을 **그대로 반사** + Credentials true | 아무 사이트나 로그인 사용자 데이터 탈취 |
| `null` 출처 허용 | sandbox iframe·로컬 파일에서 우회 |
| 접두·접미 문자열만 비교 (`a.com.evil.net`) | 정규식 실수로 공격 도메인 통과 |

> [!함정] `*` 와 Credentials 는 같이 못 쓴다
> `Allow-Origin: *` 이면 브라우저가 쿠키 포함 응답을 거부한다. 그래서 개발자가 **Origin 반사**로 바꾸다 취약해진다.

## 클릭재킹 (Clickjacking, UI Redressing)

공격 페이지 위에 **투명한 iframe** 으로 정상 사이트를 겹쳐 놓고, 사용자가 엉뚱한 버튼(송금·권한 허용)을 누르게 한다.

| 대응 | 설정 | 비고 |
|---|---|---|
| **CSP frame-ancestors** | `frame-ancestors 'none'` 또는 `'self'` | **현행 권장** |
| **X-Frame-Options** | `DENY` / `SAMEORIGIN` | 구형 브라우저 호환용 |
| 프레임 버스팅 스크립트 | `if (top !== self) …` | sandbox 속성으로 우회 가능 → 보조 수단 |

> [!함정] `X-Frame-Options: ALLOW-FROM` 은 폐기
> 주요 브라우저가 지원하지 않는다. 특정 출처만 허용하려면 `frame-ancestors https://b.com` 을 쓴다.

## 오픈 리다이렉트 (Open Redirect)

`https://bank.com/login?next=https://evil.com` 처럼 **이동할 주소를 검증 없이** 받아 `Location` 으로 보낸다. 링크가 진짜 도메인으로 시작해 **피싱 신뢰도**가 올라간다.

- OAuth 에서는 `redirect_uri` 검증이 느슨하면 **인가 코드·토큰 탈취**로 이어진다
- 대응: 이동 대상 **화이트리스트** · 상대경로만 허용 · 외부 이동 시 경고 페이지

## 경로 조작 (Path Traversal, 디렉터리 트래버설)

파일명을 입력받아 서버 파일을 여는 기능에서 `../` 로 웹 루트 밖 파일을 읽는다.

```
GET /download?file=../../../../etc/passwd
GET /download?file=..%2f..%2f..%2fetc%2fpasswd        # URL 인코딩
GET /scripts/..%c0%af../winnt/system32/cmd.exe?/c+dir   # IIS 유니코드 (구형)
```

| 대응 | 내용 |
|---|---|
| **정규화 후 검증** | 디코딩·경로 정규화(canonicalize) 뒤 허용 디렉터리 안인지 확인 |
| 입력 대신 **ID 매핑** | `file=3` → 서버가 실제 경로 결정 |
| 문자 필터 | `../` `..\` `%00` 차단 (단독으론 우회 쉬움) |
| 권한 최소화 | 웹 계정 권한 축소 · chroot |

- 행안부 SW 보안약점 명칭: **경로 조작 및 자원 삽입** (입력데이터 검증 및 표현)

> [!함정] 필터만으로는 못 막는다
> `....//` 처럼 한 번 지우면 다시 `../` 가 되는 입력, 이중 인코딩이 있다. **디코딩 → 정규화 → 검증** 순서를 지켜야 한다.

## 기출 포인트

> [!시험] 이렇게 나온다
> 출처(Origin) 3요소 · CORS 헤더 이름과 Origin 반사 취약점 · 클릭재킹 정의와 X-Frame-Options/frame-ancestors 값 · 오픈 리다이렉트 대응 · 경로 조작 페이로드 해석과 대응
