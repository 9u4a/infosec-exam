---
title: REST API 보안 (동작 · 인증 · 설정 · OWASP API Security Top 10)
domain: 애플리케이션보안
questions: []
tags: [REST, API, OWASP API Top 10, BOLA, JWT, OAuth, API Key, Rate Limit, API Gateway, CORS]
related: [애플리케이션보안/owasp-top10과-시큐어-sdlc, 애플리케이션보안/인젝션-웹셸-요청위조-스머글링]
---

> 기준 시점: 2026-09 · OWASP API Security Top 10 **2023** · RFC 9110(HTTP Semantics) · RFC 7519(JWT).

> [!시험] 2027 실기 출제기준 신설 항목
> "REST API 서비스의 동작 절차, 환경 설정, 보안 기법(OWASP API Security Top 10 등)" — 2027년 1회 시험부터 적용 예정. 공식 출제기준 원문으로 최종 확인.

## 한 줄 정의

**REST API** 는 자원(Resource)을 **URI** 로 표현하고 **HTTP 메서드**로 조작하며, 서버가 세션 상태를 저장하지 않는(**Stateless**) 웹 API 설계 방식이다. 화면 없이 데이터만 주고받으므로 **요청마다 인증·인가 검증**이 보안의 핵심이다.

## REST 동작 절차

1. 클라이언트가 **인증**해 토큰(API Key·액세스 토큰·JWT)을 받는다
2. 요청마다 `Authorization` 헤더에 토큰을 실어 **URI + 메서드**로 호출
3. 서버(또는 API Gateway)가 토큰 검증 → **이 사용자가 이 객체에 이 동작을 할 권한**이 있는지 인가
4. 처리 결과를 **JSON** 과 **HTTP 상태 코드**로 응답

| 메서드 | 의미 | 멱등성 | 예 |
|---|---|---|---|
| **GET** | 조회 | O | `GET /users/12` |
| **POST** | 생성 | X | `POST /users` |
| **PUT** | 전체 수정(대체) | O | `PUT /users/12` |
| **PATCH** | 부분 수정 | X (구현 따라) | `PATCH /users/12` |
| **DELETE** | 삭제 | O | `DELETE /users/12` |

| 상태 코드 | 의미 | 보안 관점 |
|---|---|---|
| **401** Unauthorized | 인증 안 됨 (토큰 없음·만료) | 인증 실패 |
| **403** Forbidden | 인증은 됐지만 권한 없음 | 인가 실패 |
| **429** Too Many Requests | 호출 한도 초과 | Rate Limiting 동작 |
| 500 | 서버 오류 | 스택 트레이스 노출 금지 |

> [!함정] 401 과 403
> **401 = 누군지 모름(인증)**, **403 = 누군지 알지만 안 됨(인가)**. 이름(Unauthorized)과 의미가 어긋나 자주 헷갈린다.

## API 인증 방식

| 방식 | 내용 | 주의 |
|---|---|---|
| **API Key** | 고정 키를 헤더·쿼리로 전달 | 앱 식별용, 사용자 인증으론 약함, URL 노출 금지 |
| **OAuth 2.0 Bearer** | 인가 서버가 발급한 액세스 토큰 | **권한 위임**용, 만료·스코프 최소화 |
| **JWT** | `헤더.페이로드.서명` (Base64URL) | 페이로드는 **암호화 아님**, 서명 검증 필수 |
| mTLS | 클라이언트 인증서로 상호 인증 | 서버 간(B2B) 통신 |

> [!함정] JWT 페이로드는 누구나 읽는다
> Base64URL **인코딩**일 뿐 암호화가 아니다 → 비밀번호·개인정보를 넣지 않는다. `alg: none` 허용·약한 HMAC 키·서명 미검증이 대표 취약점이다.

## OWASP API Security Top 10 (2023)

| 순위 | 항목 | 핵심 |
|---|---|---|
| **API1** | **BOLA** (객체 수준 인가 취약) | `/orders/1001` → `1002` 로 바꿔 남의 데이터 조회 |
| API2 | 인증 취약 (Broken Authentication) | 토큰 검증 누락·무차별 대입 허용 |
| API3 | **BOPLA** (객체 속성 수준 인가 취약) | 과도한 데이터 노출 + **Mass Assignment** (`"role":"admin"` 주입) |
| API4 | 무제한 자원 소비 | Rate Limit·페이지 크기 제한 없음 → DoS·과금 폭탄 |
| API5 | **BFLA** (기능 수준 인가 취약) | 일반 사용자가 `/admin/...` 관리 기능 호출 |
| API6 | 민감 비즈니스 흐름 무제한 접근 | 매크로 대량 예매·쿠폰 남용 |
| API7 | **SSRF** | API 가 사용자 입력 URL 로 내부 자원 요청 |
| API8 | 보안 설정 오류 | CORS `*`, 디버그 모드, 불필요 메서드 허용 |
| API9 | 부적절한 인벤토리 관리 | 방치된 구버전(`/v1`)·테스트 API 노출 |
| API10 | 안전하지 않은 API 소비 | 제3자 API 응답을 검증 없이 신뢰 |

> [!암기] 인가 3형제
> **BOLA**(남의 **객체**) · **BOPLA**(객체의 **속성**) · **BFLA**(관리 **기능**). 셋 다 "인증은 됐는데 권한 검사가 빠진" 문제다.

## 보안 기법 · 환경 설정

| 영역 | 설정 |
|---|---|
| 전송 | **HTTPS(TLS 1.2+) 강제**, HSTS |
| 인증·인가 | 모든 엔드포인트에서 토큰 검증 + **객체 소유자 확인**(BOLA 방지) |
| 입력 | 스키마 검증(OpenAPI), 허용 필드만 바인딩(Mass Assignment 방지) |
| 출력 | 필요한 필드만 응답, 오류 메시지에 내부 정보 제외 |
| 제한 | **Rate Limiting**·쿼터, 요청 크기·페이지 수 제한 |
| CORS | `Access-Control-Allow-Origin` 에 신뢰 출처만, `*` + 자격증명 금지 |
| 관리 | **API Gateway** 로 인증·제한·로깅 일원화, API 인벤토리·구버전 폐기 |
| 모니터링 | 호출 로그·이상 탐지, WAF/WAAP 적용 |

## 기출 포인트

> [!시험] 이렇게 나올 수 있다 (신설 항목)
> HTTP 메서드별 의미 · 401/403/429 구분 · JWT 구조와 서명 검증 · BOLA/BOPLA/BFLA 구분과 대응 · Rate Limiting·API Gateway 역할 · 취약 설정(CORS `*`, 구버전 API 방치)
