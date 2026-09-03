---
title: XSS 3유형 & CSRF
domain: 애플리케이션보안
questions: [3-9, 4-2, 14-16, 15-1, 16-11, 22-15, 26-9, 26-16, 28-4, 31-10, 31-14, 31-18, 32-6, 5-13]
tags: [XSS, CSRF, 쿠키, HttpOnly, SameSite, CSRF토큰]
---

## XSS (Cross-Site Scripting)

응답에 실린 악성 스크립트가 **피해자 브라우저에서 실행** → 쿠키·세션 탈취, 화면 변조, 리다이렉트, 키로깅.

| 유형 | 저장 위치 | 트리거 | 파급력 |
|---|---|---|---|
| **Reflected(반사형)** | 저장 안 됨 | 악성 URL 클릭 (파라미터가 응답에 반사) | 표적(1인) |
| **Stored(저장형)** | 서버 DB(게시글·댓글·프로필) | 페이지 열람 | **최대** (열람자 전원) |
| **DOM Based** | — (서버 안 거침) | JS가 `location`, `innerHTML` 등을 안전하지 않게 처리 | 클라이언트에서 발생 |

### 점검
`<script>alert(document.cookie)</script>` 삽입 → 실행되면 필터링 부재

### 대응
- **출력 시 컨텍스트별 인코딩** (HTML body / 속성 / JS / URL / CSS 각각 다름) — 가장 중요
- 입력값 검증 (태그 허용 시 화이트리스트)
- **CSP**(Content-Security-Policy) 헤더로 인라인 스크립트·외부 출처 제한
- 쿠키에 **HttpOnly** (JS 접근 차단 → 쿠키 탈취 방어)
- 프레임워크 자동 이스케이프 활용 (React JSX, Thymeleaf 등)

## CSRF (Cross-Site Request Forgery)

인증된 피해자의 브라우저가 **쿠키를 자동 첨부**하는 점을 악용 → 공격자 페이지에서 피해자 명의의 상태변경 요청(비밀번호 변경, 이체, 설정 변경)을 유발. 서버가 "정상 폼 요청"과 "위조 요청"을 구분 못 하는 것이 원인.

### 대응
- **CSRF 토큰**: 요청마다 서버가 임의 토큰 발급 → 세션 저장값과 대조 (외부 페이지는 토큰을 알 수 없음)
- **SameSite 쿠키** (`Lax`/`Strict`) — 교차 사이트 요청에 쿠키 미전송
- **Referer / Origin 헤더 검증**
- 중요 기능 **재인증**(비밀번호 재입력)
- 상태변경은 GET 금지, POST + 토큰

## 세션 vs 쿠키 (31-18)

| | 쿠키 (Cookie) | 세션 (Session) |
|---|---|---|
| 저장 위치 | **클라이언트**(브라우저) | **서버**(세션 저장소), 클라이언트엔 세션 ID만 |
| 전달 | HTTP 요청·응답 헤더(`Cookie` / `Set-Cookie`) | 쿠키에 담긴 세션 ID로 서버가 조회 |
| 보안 | 스니핑·XSS·변조로 노출·조작 위험 | 값이 서버에 있어 상대적으로 안전, 세션 ID 탈취(하이재킹)는 여전히 위험 |
| 수명 | `Expires`/`Max-Age` | 서버 타임아웃 |

- 대응: 세션 ID는 로그인 후 재발급, 유휴 타임아웃, `Secure`+`HttpOnly`+`SameSite` 쿠키, HTTPS 전 구간.

## 쿠키 보안 속성 (22-15)

| 속성 | 기능 | 방어 |
|---|---|---|
| **Secure** | HTTPS(SSL/TLS) 연결에서만 쿠키 전송 | 평문 구간 스니핑 |
| **HttpOnly** | JavaScript(`document.cookie`) 접근 차단 | XSS 쿠키 탈취 |
| **SameSite** | 교차 사이트 요청에 쿠키 미전송 (`Lax`/`Strict`) | CSRF |
| **Expires / Max-Age** | 만료 시각 지정 | 탈취 쿠키 재사용 창 축소 |

## URL Rewrite / mod_rewrite (31-10)

**IIS의 URL Rewrite 모듈**(Apache는 `mod_rewrite`)은 요청 URL 패턴을 정의해 다른 URL로 **재작성·리디렉션**한다.
- 보안 활용: 악성 패턴 URL 차단, 확장자 숨김, HTTPS 강제, 디렉터리 트래버설·인젝션 시도 URL 정규화·거부.
- 그 자체가 방화벽은 아니며 WAF·입력검증을 보완하는 수단.
