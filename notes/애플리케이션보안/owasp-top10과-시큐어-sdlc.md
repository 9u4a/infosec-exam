---
title: OWASP Top 10 · 시큐어 SDLC
domain: 애플리케이션보안
questions: []
tags: [OWASP, 시큐어코딩, SDLC, SDL, SAST, DAST, 위협모델링]
---

> 개별 취약점은 각 노트에 있으나 전체 틀 정리. 필기·실기 공통.

## OWASP Top 10 (2021)

| 순위 | 항목 | 핵심 | 관련 노트 |
|---|---|---|---|
| A01 | **취약한 접근 통제 (Broken Access Control)** | 권한 상승, IDOR, 강제 브라우징 | 접근통제-모델 |
| A02 | **암호화 실패 (Cryptographic Failures)** | 평문 전송·저장, 약한 알고리즘, 하드코딩 키 | 암호학-기초, db보안 |
| A03 | **인젝션 (Injection)** | SQLi, OS 명령, LDAP, XPath, XSS | sql-injection, 인젝션-웹셸 |
| A04 | **안전하지 않은 설계 (Insecure Design)** | 설계 단계 위협 모델링 부재 | (본 노트) |
| A05 | **보안 설정 오류 (Security Misconfiguration)** | 기본 계정, 디렉터리 인덱싱, 불필요 기능, 상세 오류 | 아파치-웹서버 |
| A06 | **취약·구식 컴포넌트 (Vulnerable Components)** | 오래된 라이브러리(Log4j, Struts) | 주요-취약점 |
| A07 | **식별·인증 실패 (Identification & Auth Failures)** | 약한 비밀번호, 세션 고정, 크리덴셜 스터핑 | xss-csrf, 인증관리 |
| A08 | **SW·데이터 무결성 실패 (Integrity Failures)** | 무결성 검증 없는 업데이트, 안전하지 않은 역직렬화, CI/CD 침해 | apt-킬체인(공급망) |
| A09 | **보안 로깅·모니터링 실패** | 로그 부재, 탐지 지연 | 보안관제 |
| A10 | **SSRF (Server-Side Request Forgery)** | 서버가 신뢰하는 내부 리소스로 요청 유도 | 인젝션-웹셸 |

- 2017 → 2021 변화: XXE는 A05에 흡수, XSS는 A03(인젝션)에 통합, A04·A08·A10 신설.

## 시큐어 SDLC / SDL

개발 생명주기 **각 단계에 보안 활동을 내재화** (사후 조치보다 저비용).

| 단계 | 보안 활동 |
|---|---|
| **요구사항** | 보안 요구사항 정의, 규제·컴플라이언스 식별, 오·남용 사례(abuse case) |
| **설계** | **위협 모델링(STRIDE)**, 보안 아키텍처 검토, 공격 표면 분석 |
| **구현(개발)** | **시큐어 코딩 가이드** 준수, 코드 리뷰, **SAST(정적 분석)** |
| **테스트** | **DAST(동적 분석)**, 퍼징, 모의해킹, IAST |
| **배포/운영** | 보안 설정 하드닝, 취약점 스캔, 침투 테스트, 패치 관리 |
| **폐기** | 데이터 완전 삭제, 계정·인증서 정리 |

- 모델: MS **SDL**, OWASP **SAMM**, BSIMM, **행안부 SW 개발보안 가이드**(전자정부).

## 위협 모델링 — STRIDE

| 위협 | 대응 보안 속성 |
|---|---|
| **S**poofing (위장) | 인증 |
| **T**ampering (변조) | 무결성 |
| **R**epudiation (부인) | 부인방지 |
| **I**nformation Disclosure (정보 노출) | 기밀성 |
| **D**enial of Service | 가용성 |
| **E**levation of Privilege (권한 상승) | 인가 |

- 절차: 자산 식별 → 아키텍처 분해(DFD) → 위협 도출(STRIDE) → 위험 평가(DREAD) → 대응.

## 시큐어 코딩 핵심 원칙

- **모든 입력을 불신** → 서버 측 검증(화이트리스트), 정규화 후 검증.
- **출력 인코딩**(컨텍스트별), **파라미터 바인딩**(SQL·명령·XML).
- **최소 권한**, 안전한 기본값(fail-safe defaults), 다중 방어(defense in depth).
- 민감정보 하드코딩 금지, 안전한 난수·암호 API 사용, 오류 메시지 최소화.
- **행안부 7대 취약점 유형**: 입력 데이터 검증·표현 / 보안 기능 / 시간 및 상태 / 에러 처리 / 코드 오류 / 캡슐화 / API 오용.
