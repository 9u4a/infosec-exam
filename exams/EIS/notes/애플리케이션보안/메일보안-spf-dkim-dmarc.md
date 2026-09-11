---
title: 메일 보안 (SPF · DKIM · DMARC · 릴레이 제한)
domain: 애플리케이션보안
questions: [16-13, 18-14, 20-14, 21-1, 25-6, 31-9, 32-16, 19-8]
tags: [SPF, DKIM, DMARC, sendmail, 릴레이, PGP, S/MIME]
---

## 메일 프로토콜 · 포트

| 프로토콜 | 평문 | SSL/TLS | 역할 |
|---|---|---|---|
| **SMTP** | 25 (서버간), 587 (제출/STARTTLS) | 465 (SMTPS) | 메일 **송신·중계** |
| **POP3** | 110 | 995 | 서버에서 메일 **내려받고 삭제**(로컬 보관) |
| **IMAP** | 143 | 993 | 메일을 **서버에 두고 동기화**(다기기) |

- MTA(전송, sendmail·Postfix), MDA(수신함 배달), MUA(사용자 클라이언트).

## 메일 헤더 분석 (피싱·스푸핑 판별)

| 헤더 | 확인 포인트 |
|---|---|
| **Received** | 아래에서 위로 경유 서버 추적. 최하단이 최초 발신 서버 IP → 발송 도메인과 불일치 시 스푸핑 의심 |
| **Return-Path (Envelope From)** | 반송 주소. **From 헤더와 다르면** 위조 가능성 (SPF는 이 값 기준) |
| **From** | 사용자에게 보이는 발신자 — 위조 쉬움 (DMARC가 정렬 검사) |
| **Message-ID** | 발송 서버 도메인과 다르면 의심 |
| **Authentication-Results** | 수신 서버가 기록한 spf/dkim/dmarc 결과(pass/fail) |

## 발신자 위조(스푸핑) 방지 3종

| 기법 | 검증 방법 | 서명 주체 | 키 공유 |
|---|---|---|---|
| **SPF** | 수신 서버가 발송 도메인 DNS의 **SPF TXT 레코드**에 등록된 허용 IP와 실제 송신 IP를 대조 (Envelope From 기준) | — | DNS TXT |
| **DKIM** | 발신 서버가 개인키로 헤더를 **전자서명**(`DKIM-Signature`), 수신 서버가 공개키로 검증 | **발신 메일 서버** | DNS TXT(공개키) |
| **DMARC** | SPF·DKIM 결과 + **From 헤더 정렬(alignment)** 확인, 실패 시 정책(`none`/`quarantine`/`reject`)과 리포트 | — | DNS TXT |

- SPF만: 전달(forwarding) 시 깨짐 / DKIM만: From 위조 방어 불가 → **DMARC**가 둘을 묶음

### DNS 레코드 예시

```
; SPF (도메인 TXT)
example.com.  IN TXT  "v=spf1 ip4:203.0.113.0/24 include:_spf.google.com -all"
   ─ ip4/ip6/a/mx/include 로 허용 발신원 나열, 끝의 한정자: -all(hard fail) ~all(soft) ?all(neutral)

; DKIM (셀렉터._domainkey 하위 TXT)
sel1._domainkey.example.com.  IN TXT  "v=DKIM1; k=rsa; p=MIGfMA0G...공개키..."

; DMARC (_dmarc 하위 TXT)
_dmarc.example.com.  IN TXT  "v=DMARC1; p=reject; rua=mailto:dmarc@example.com; adkim=s; aspf=r; pct=100"
   ─ p: none(모니터링)/quarantine(격리)/reject(거부), rua: 집계 리포트, pct: 적용 비율
```

## 스팸 대응 기법

| 기법 | 원리 |
|---|---|
| **RBL/DNSBL** | 스팸 발송 IP 블랙리스트를 DNS 질의로 조회해 차단 |
| **Greylisting(그레이리스팅)** | 처음 보는 발신자는 일시 거부(4xx) → 정상 MTA는 재시도, 스팸봇은 재시도 안 함 |
| **SpamAssassin 등 내용 필터** | 베이지안·규칙 점수 기반 |
| **역방향 DNS(PTR) 확인** | 발송 IP의 PTR 레코드가 없으면 감점 |
| **레이트 리밋 / 인증 강제(587+SMTP AUTH)** | 오픈 릴레이 방지 |

## sendmail 릴레이 제한

오픈 릴레이(무제한 중계)는 스팸 발송 경유지로 악용 → 반드시 제한.

| 파일 | 역할 |
|---|---|
| `sendmail.cf` | 메인 설정 (sendmail.mc 컴파일 결과), `Relaying denied` 규칙 |
| `/etc/mail/access` | 도메인·IP별 정책 (텍스트) |
| `/etc/mail/access.db` | `makemap hash access.db < access` 로 생성 (실제 참조본) |

access 정책값: **RELAY**(중계 허용) · **REJECT**(거부+오류회신) · **DISCARD**(조용히 폐기) · **OK**(수신 허용)

## 메일 내용 보안

| 기술 | 신뢰 모델 | 특징 |
|---|---|---|
| **PGP** | 신뢰의 웹(사용자 상호 서명) | 무료 배포로 널리 사용, 필 짐머만 |
| **PEM** | 계층적 CA | 보안성 높으나 보급 실패 |
| **S/MIME** | X.509 CA | 기업 표준, 메일 클라이언트 내장 |

공통: 대칭키로 본문 암호화 + 전자서명(무결성·인증·부인방지).
