---
title: 메일 보안 (SPF · DKIM · DMARC · 릴레이 제한)
domain: 애플리케이션보안
questions: [16-13, 18-14, 20-14, 21-1, 25-6, 31-9, 32-16, 2-3, 19-8]
tags: [SPF, DKIM, DMARC, sendmail, 릴레이, PGP, S/MIME]
---

## 발신자 위조(스푸핑) 방지 3종

| 기법 | 검증 방법 | 서명 주체 | 키 공유 |
|---|---|---|---|
| **SPF** | 수신 서버가 발송 도메인 DNS의 **SPF TXT 레코드**에 등록된 허용 IP와 실제 송신 IP를 대조 (Envelope From 기준) | — | DNS TXT |
| **DKIM** | 발신 서버가 개인키로 헤더를 **전자서명**(`DKIM-Signature`), 수신 서버가 공개키로 검증 | **발신 메일 서버** | DNS TXT(공개키) |
| **DMARC** | SPF·DKIM 결과 + **From 헤더 정렬(alignment)** 확인, 실패 시 정책(`none`/`quarantine`/`reject`)과 리포트 | — | DNS TXT |

- SPF만: 전달(forwarding) 시 깨짐 / DKIM만: From 위조 방어 불가 → **DMARC**가 둘을 묶음

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
