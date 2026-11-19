---
title: REST API 보안 (동작 · 인증 · 설정 · OWASP API Security Top 10)
domain: 애플리케이션보안
questions: []
tags: [REST, API, OWASP API Top 10, BOLA, JWT, OAuth, API Key, Rate Limit, API Gateway, CORS]
related: [애플리케이션보안/owasp-top10과-시큐어-sdlc, 애플리케이션보안/인젝션-웹셸-요청위조-스머글링]
---

> 기준 시점: 2026-11 · OWASP API Security Top 10 2023 · RFC 9110·5789·6585 · RFC 7519·8725 · RFC 6749·9700 · Fielding 논문(2000) 5장 · WHATWG Fetch · NIST SP 800-52r2 · KCA 정보보안기사 출제기준(2027~2029).

> [!시험] 2027 실기 출제기준 신설 항목 (실기 1-3-4)
> 세부항목 「서비스별 보안특성 파악하기」 세세항목 4 — "REST API 서비스의 동작절차와 환경 설정, 보안 기법(OWASP API Security Top 10 등)을 이해할 수 있다." (적용 2027.1.1.~2029.12.31.)

## 한 줄 정의

**REST API** 는 자원(Resource)을 **URI** 로 표현하고 **HTTP 메서드**로 조작하며, 서버가 세션 상태를 저장하지 않는(**Stateless**) 웹 API 설계 방식이다. 화면 없이 데이터만 주고받으므로 **요청마다 인증·인가 검증**이 보안의 핵심이다.

## REST 6대 아키텍처 제약 (Fielding 5.1)

| 제약 | 뜻 |
|---|---|
| **Client-Server** | UI(클라이언트)와 데이터 저장(서버) 관심사 분리 |
| **Stateless** | 요청마다 필요한 정보를 모두 담음, 서버는 세션 상태 보관 안 함 |
| **Cache** | 응답에 캐시 가능 여부를 표시 |
| **Uniform Interface** | 자원 식별 · 표현을 통한 조작 · 자기서술 메시지 · **HATEOAS** |
| **Layered System** | 게이트웨이·프록시 등 계층 구성, 클라이언트는 바로 옆 계층만 앎 |
| Code-On-Demand | 서버가 코드(스크립트) 전송 — 유일한 **선택(optional)** 제약 |

## REST 동작 절차

1. 클라이언트가 **인증**해 토큰(API Key·액세스 토큰·JWT)을 받는다
2. 요청마다 `Authorization` 헤더에 토큰을 실어 **URI + 메서드**로 호출
3. 서버(또는 API Gateway)가 토큰 검증 → **이 사용자가 이 객체에 이 동작을 할 권한**이 있는지 인가
4. 처리 결과를 **JSON** 과 **HTTP 상태 코드**로 응답

- **안전(safe)**: 사실상 읽기 전용 — 서버 상태 변경을 요청·기대하지 않음 (RFC 9110 §9.2.1)
- **멱등(idempotent)**: 같은 요청을 여러 번 보내도 의도된 효과가 1번과 같음 (§9.2.2)

| 메서드 | 의미 | 안전 | 멱등 | 예 |
|---|---|---|---|---|
| **GET** | 조회 | O | O | `GET /users/12` |
| **POST** | 생성 | X | X | `POST /users` |
| **PUT** | 전체 수정(대체) | X | O | `PUT /users/12` |
| **PATCH** | 부분 수정 (RFC 5789) | X | X | `PATCH /users/12` |
| **DELETE** | 삭제 | X | O | `DELETE /users/12` |

> [!함정] 안전 ⊂ 멱등, PATCH 는 RFC 9110 에 없다
> 안전 메서드는 GET·HEAD·OPTIONS·TRACE, 멱등은 여기에 **PUT·DELETE** 를 더한 것. PATCH 는 RFC 5789 정의로 "neither safe nor idempotent"(조건부 요청으로 멱등화는 가능).

| 상태 코드 | 의미 | 보안 관점 |
|---|---|---|
| **401** Unauthorized | 유효한 인증 자격증명 없음 | 서버는 **WWW-Authenticate** 헤더 필수 |
| **403** Forbidden | 요청은 이해했으나 수행 거부 | 인가 실패. 존재를 숨기려면 **404** 로 대체 가능 |
| **429** Too Many Requests | 일정 시간 내 요청 과다 (RFC 6585) | Rate Limiting, **Retry-After** 로 대기 안내 |
| 500 | 서버 오류 | 스택 트레이스 노출 금지 (API8) |

> [!함정] 401 과 403
> **401 = 누군지 모름(인증)**, **403 = 누군지 알지만 안 됨(인가)**. 이름(Unauthorized)과 의미가 어긋나 자주 헷갈린다.

## API 인증 방식

| 방식 | 내용 | 주의 |
|---|---|---|
| **API Key** | 고정 키를 헤더·쿼리로 전달 | 앱 식별용, URL 노출 금지 — OWASP: API 키는 인증이 아님 |
| **OAuth 2.0** | 인가 서버가 발급한 액세스 토큰 (RFC 6749) | **권한 위임**용, 만료·스코프·audience 제한 |
| **JWT** | 클레임을 JWS(서명) 또는 JWE(암호화)로 표현 | JWS 는 `헤더.페이로드.서명` 3부분, 서명 검증 필수 |
| mTLS | 클라이언트 인증서로 상호 인증 | 서버 간(B2B) 통신, 토큰 sender-constrain 수단 |

> [!함정] JWS 페이로드는 누구나 읽는다
> 흔히 쓰는 JWS 형식은 Base64URL **인코딩**일 뿐 암호화가 아니다(암호화는 5부분 JWE). 비밀번호·개인정보를 넣지 않는다.

**JWT 검증 요점 (RFC 8725, BCP 225)**

- 허용 알고리즘만 받고 그 외 거부. `none` 은 명시 요청 없으면 생성·소비 금지 (§3.1–3.2)
- 사람이 외운 비밀번호를 HMAC(HS256) 키로 직접 쓰지 않는다 (§3.5)
- `iss`·키 소유 일치(§3.8), `aud` 불일치·누락 시 거부(§3.9), `exp` 확인(RFC 7519 §4.1.4)
- `kid` 값 정제(인젝션), `jku`·`x5u` URL 은 허용 목록(SSRF) (§3.10)

**OAuth 2.0 보안 BCP (RFC 9700, 2025.1, BCP 240)**

- RFC 6749 역할 4: 자원 소유자 · 자원 서버 · 클라이언트 · 인가 서버
- **Implicit 그랜트 SHOULD NOT**, **ROPC(비밀번호) 그랜트 MUST NOT**
- Authorization Code + **PKCE** — 공개 클라이언트는 PKCE **MUST**
- redirect URI **정확한 문자열 일치**, 액세스 토큰 audience 제한·sender-constrain

## OWASP API Security Top 10 (2023)

| 순위 | 공식 명칭 | 핵심 · 대표 예방책 |
|---|---|---|
| **API1** | Broken Object Level Authorization (**BOLA**) | `/orders/1001`→`1002` 조회. 모든 객체 접근에 권한 확인, 예측 불가 ID |
| API2 | Broken Authentication | 토큰 탈취·사칭. 표준 사용, 비번 찾기도 무차별대입 방어 |
| API3 | Broken Object Property Level Authorization (**BOPLA**) | 과도한 데이터 노출 + **Mass Assignment**. 필요한 속성만 반환·바인딩 |
| API4 | Unrestricted Resource Consumption | DoS·건당 과금 폭탄. Rate Limit, 페이로드·배열 크기 상한 |
| API5 | Broken Function Level Authorization (**BFLA**) | 일반 사용자가 관리 기능 호출. **기본 거부** + 역할별 허용 |
| API6 | Unrestricted Access to Sensitive Business Flows | 매크로 대량 구매. 핑거프린팅·사람 탐지 |
| API7 | Server Side Request Forgery (**SSRF**) | 사용자 URL 로 내부 요청. 허용 목록, 리다이렉트 비활성 |
| API8 | Security Misconfiguration | CORS 미설정, 불필요 HTTP verb, 스택 트레이스. 하드닝·TLS |
| API9 | Improper Inventory Management | 방치된 구버전·디버그 API. 호스트·버전 인벤토리, 문서 자동화 |
| API10 | Unsafe Consumption of APIs | 제3자 API 응답 맹신. 응답 검증·정제, 리다이렉트 허용 목록 |

> [!암기] 인가 3형제
> **BOLA**(남의 **객체**) · **BOPLA**(객체의 **속성**) · **BFLA**(관리 **기능**). 셋 다 "인증은 됐는데 권한 검사가 빠진" 문제다.

> [!팁] 2019 → 2023 변경
> Excessive Data Exposure + Mass Assignment 를 **API3(BOPLA)** 로 통합, API6(비즈니스 흐름)·API10(API 소비) 신설.

## 보안 기법 · 환경 설정

| 영역 | 설정 |
|---|---|
| 전송 | 내·외부 API 모두 **TLS** (NIST SP 800-52r2: TLS 1.2 필수, 1.3 지원), HSTS |
| 인증·인가 | 모든 엔드포인트에서 토큰 검증 + **객체 소유자 확인**(BOLA 방지) |
| 입력 | 스키마 검증(OpenAPI), 허용 필드만 바인딩(Mass Assignment 방지) |
| 출력 | 필요한 필드만 응답, 오류 메시지에 내부 정보 제외 |
| 제한 | **Rate Limiting**·쿼터, 요청 크기·페이지 수 제한 |
| CORS | 신뢰 출처만 허용. 자격증명 요청엔 `Allow-Origin: *` 불가(Fetch) |
| 관리 | **API Gateway** 로 인증·제한·로깅 일원화, API 인벤토리·구버전 폐기 |
| 모니터링 | 호출 로그·이상 탐지, WAF/WAAP 적용 |

> [!팁] 국내 처분 사례로 보는 API 위험
> 쿠팡이츠 API 가 배달원 실명·번호를 음식점에 그대로 전송(2024, API3 유형). 쿠팡 2026 은 서명키로 **인증토큰 위조**(API2 유형) — 상세는 개인정보 유출사고 노트.

## 기출 포인트

> [!시험] 이렇게 나올 수 있다 (신설 항목)
> 메서드별 안전·멱등 · 401/403/429 구분 · JWT 구조와 검증(alg·aud·exp) · BOLA/BOPLA/BFLA 구분과 대응 · OAuth Implicit 대신 PKCE · Rate Limiting·API Gateway 역할 · 취약 설정(CORS, 구버전 API)
