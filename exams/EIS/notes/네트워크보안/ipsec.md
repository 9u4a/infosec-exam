---
title: IPSec (AH / ESP / IKE)
domain: 네트워크보안
questions: [3-14, 4-11, 6-11, 8-11, 12-2, 13-13, 14-3, 15-11, 21-7, 25-3, 28-15, 30-2, 11-3, 15-10, 20-6]
tags: [IPSec, AH, ESP, IKE, 전송모드, 터널모드, VPN, L2F, PPTP, L2TP]
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
  - **Phase 1**: 양단 인증 + 안전한 관리채널 수립. **Main 모드**(6개 메시지, ID 보호) / **Aggressive 모드**(3개 메시지, 빠르지만 ID 노출). Diffie-Hellman으로 공유 비밀 생성.
  - **Phase 2**: Phase 1 채널 위에서 실제 데이터용 IPSec SA(AH/ESP·모드·알고리즘·수명) 협상. **Quick 모드**. PFS 옵션 시 DH 재수행.
- **SA(Security Association)**: 단방향 논리적 연결. 양방향 통신엔 SA 2개. **SPI**(Security Parameter Index)로 식별.
- **SAD**(SA 데이터베이스) = 각 SA의 파라미터, **SPD**(보안정책 DB) = "어떤 트래픽에 IPSec을 적용/우회/폐기할지" 정책.

## 서술형 3줄 요약 답안

- **AH vs ESP**: 둘 다 무결성·인증·재전송 방지를 제공하나 **기밀성(암호화)은 ESP만** 제공한다. AH는 IP 헤더까지 인증 범위에 넣어 **NAT를 통과하지 못한다**. 실무는 대부분 ESP를 쓴다.
- **전송 vs 터널 모드**: 전송 모드는 IP 페이로드만 보호(호스트 간), 터널 모드는 **원본 IP 패킷 전체를 암호화하고 새 IP 헤더를 붙여** 게이트웨이 간 VPN에 쓴다.
- **IKE 2단계**: Phase 1에서 상호 인증 후 관리채널(ISAKMP SA)을 만들고, Phase 2에서 그 채널로 실제 트래픽용 IPSec SA를 협상한다.

## IPSec이 제공하는 보안 서비스 (20-6)

기밀성 · 데이터 근원지 인증 · 비연결형 무결성 · 재전송 공격 방지(anti-replay) · 접근제어 · **제한된 트래픽 흐름의 기밀성**(터널 모드).

## VPN 터널링 프로토콜 계층 (11-3, 15-10)

| 프로토콜 | 계층 | 개발/특징 |
|---|---|---|
| **L2F** | 2계층 | Cisco. 인증만, 암호화 없음 |
| **PPTP** | 2계층 | MS·3Com 등. GRE + PPP, 구현 쉬움, 보안 약함(MS-CHAPv2 취약) |
| **L2TP** | 2계층 | L2F + PPTP 결합. 자체 암호화 없음 → 보통 **L2TP/IPSec** 로 사용 |
| **IPSec** | 3계층 | IETF 표준. AH/ESP로 인증·암호화. 사이트-사이트 VPN 주력 |
| **SSL/TLS VPN** | 4~7계층 | 브라우저만으로 접속(Clientless), 사용자 단위 접근제어 |

- 11-3 빈칸: (A) IPSec (B) AH (C) ESP.
- 2계층 터널링은 비 IP 프로토콜도 캡슐화 가능하지만 자체 보안이 약해 IPSec과 결합.
