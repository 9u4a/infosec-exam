---
title: IPSec (AH / ESP / IKE)
domain: 네트워크보안
questions: [3-14, 4-11, 6-11, 8-11, 12-2, 13-13, 14-3, 15-11, 21-7, 25-3, 28-15, 30-2]
tags: [IPSec, AH, ESP, IKE, 전송모드, 터널모드, VPN]
---

## 세부 프로토콜

| | AH (프로토콜 51) | ESP (프로토콜 50) |
|---|---|---|
| 무결성 | O | O |
| 인증 | O | O |
| **기밀성(암호화)** | **X** | **O** |
| 재전송 방지 | O (Sequence Number) | O (Sequence Number) |
| NAT 통과 | **불가** (IP 헤더까지 인증) | 가능 (NAT-T) |

- 30회 2번 포인트: **재전송 공격 방지** = AH/ESP 헤더의 **Sequence Number** 필드.
- AH가 NAT를 못 넘는 이유: 인증 범위에 **IP 헤더(출발지/목적지 IP)** 가 포함되어 NAT가 IP를 바꾸면 무결성 검증 실패. → 구형 장비 AH 문제는 IPSec 모듈 업그레이드(NAT-T 지원)로 해결.

## 동작 모드

| | 전송(Transport) 모드 | 터널(Tunnel) 모드 |
|---|---|---|
| 보호 대상 | IP 페이로드(TCP 헤더+데이터) | **원본 IP 패킷 전체** |
| 새 IP 헤더 | 없음 | **추가됨** |
| 용도 | 호스트 ↔ 호스트 (End-to-End) | 게이트웨이 ↔ 게이트웨이 (VPN) |

### ESP 터널 모드 필드 순서
`[새 IP 헤더][ESP 헤더][원본 IP 헤더][TCP 헤더][데이터][ESP 트레일러][ESP 인증]`

- **암호화 범위**: ESP 헤더 다음부터 ESP 트레일러까지 (원본 IP 헤더 포함, 데이터 포함)
- **인증 범위**: ESP 헤더부터 ESP 트레일러까지 (새 IP 헤더 제외)

## 키 교환

- **IKE** (ISAKMP/Oakley), UDP 500. 2단계: Phase 1(ISAKMP SA, 관리채널) → Phase 2(IPSec SA, 실제 통신).
