---
title: 인증 프로토콜 (AAA · RADIUS · TACACS+ · Diameter · 802.1X · FIDO)
domain: 정보보안일반
questions: []
tags: [AAA, RADIUS, TACACS+, Diameter, 802.1X, EAP, FIDO, FIDO2, WebAuthn, 패스키]
related: [정보보안일반/인증관리와-기타-보안용어, 네트워크보안/무선랜-보안]
---

> 기준 시점: 2026-09 · RFC 2865/2866(RADIUS) · RFC 8907(TACACS+) · RFC 6733(Diameter) · FIDO2(WebAuthn Level 2).

## 한 줄 정의

**AAA** 는 네트워크·장비 접속을 **중앙 서버**에서 **인증(Authentication) → 인가(Authorization) → 계정관리(Accounting, 사용 기록)** 하는 틀이다. 이를 구현하는 프로토콜이 RADIUS·TACACS+·Diameter 이고, **FIDO** 는 비밀번호 대신 **공개키 + 기기 내 생체·PIN** 으로 인증하는 표준이다.

## AAA 3요소

| 요소 | 질문 | 예 |
|---|---|---|
| **Authentication** | 누구인가? | ID/PW · 인증서 · OTP |
| **Authorization** | 무엇을 할 수 있는가? | VLAN 할당 · 명령어 권한 · ACL |
| **Accounting** | 무엇을 했는가? | 접속 시간 · 전송량 · 실행 명령 기록 |

## RADIUS vs TACACS+ vs Diameter

| 항목 | **RADIUS** | **TACACS+** | **Diameter** |
|---|---|---|---|
| 표준 | IETF 개방 표준 | Cisco 개발 (RFC 8907 정보성) | IETF (RADIUS 후속) |
| 전송 | **UDP 1812 / 1813** | **TCP 49** | **TCP·SCTP 3868** |
| 암호화 | **패스워드 필드만** | **패킷 본문 전체** | TLS·IPsec 로 전체 보호 |
| AAA 구조 | 인증 + 인가 **결합** | 인증·인가·과금 **분리** | 분리, 확장 가능 |
| 주 용도 | 무선랜·VPN·802.1X 사용자 인증 | **네트워크 장비 관리자** 명령 통제 | LTE·5G·IMS 가입자 인증 |

- RADIUS 옛 포트: 1645(인증)·1646(과금) — 장비에 따라 아직 보인다
- TACACS+ 는 **명령어 단위 인가**가 가능해 라우터·스위치 관리자 통제에 쓴다
- Diameter 이름은 "RADIUS(반지름)의 두 배" 라는 말장난에서 왔다

> [!함정] 암호화 범위와 전송 프로토콜
> RADIUS = **UDP + 패스워드만 암호화** · TACACS+ = **TCP + 전체 암호화**. 둘을 바꿔 쓰는 오답이 잦다.

## 802.1X 포트 기반 인증

유선·무선 포트를 **인증 전에는 막아 두고**, 인증에 성공한 단말만 연다. NAC·WPA2/3-Enterprise 의 기반이다.

| 구성 요소 | 역할 | 예 |
|---|---|---|
| **Supplicant** | 인증 요청 단말 | PC·스마트폰 |
| **Authenticator** | 포트를 열고 닫는 중계자 | 스위치·무선 AP |
| **Authentication Server** | 실제 판정 | **RADIUS 서버** |

- 단말 ↔ 스위치/AP 는 **EAPOL**(EAP over LAN), 스위치/AP ↔ 서버는 **RADIUS** 로 EAP 를 실어 나른다

| EAP 방식 | 인증서 | 특징 |
|---|---|---|
| **EAP-TLS** | 서버 + **클라이언트** | 가장 강력, 인증서 배포 부담 |
| **PEAP · EAP-TTLS** | 서버만 | TLS 터널 안에서 ID/PW 인증 |
| EAP-MD5 | 없음 | 상호인증 X, 사전공격 취약 → 사용 지양 |

## FIDO (Fast IDentity Online)

FIDO Alliance 표준이다. **비밀(개인키·생체정보)은 사용자 기기 밖으로 나가지 않고**, 서버에는 **공개키만** 저장한다.

| 규격 | 내용 |
|---|---|
| **UAF** | 패스워드리스 — 기기 내 생체·PIN 으로 인증 |
| **U2F** | 2차 인증 — ID/PW 후 보안키(USB·NFC) 터치 |
| **FIDO2** | **WebAuthn**(W3C, 브라우저 API) + **CTAP**(인증기 ↔ 클라이언트) |
| **패스키** | FIDO2 자격증명을 기기 간 **동기화** 가능하게 한 형태 |

1. **등록**: 인증기가 서비스별 **키 쌍 생성** → 공개키만 서버에 등록
2. **인증**: 서버가 **챌린지** 전송 → 사용자가 기기에서 생체·PIN 확인
3. 인증기가 **개인키로 챌린지 서명** → 서버가 공개키로 검증

> [!팁] 왜 피싱에 강한가
> 서명에 **접속 중인 사이트의 출처(origin)** 가 묶인다. 가짜 사이트에서 받은 서명은 진짜 서버에서 검증되지 않는다.

> [!함정] 생체정보는 서버에 없다
> FIDO 서버는 **공개키만** 보관한다. 생체 템플릿은 **기기 안**(TEE·보안칩)에서만 쓰인다 → 서버가 털려도 재사용 불가.

## 기출 포인트

> [!시험] 이렇게 나온다
> AAA 3요소 뜻 · RADIUS/TACACS+ 의 전송 프로토콜·포트·암호화 범위 비교 · 802.1X 3구성요소 · EAP-TLS 와 PEAP 차이 · FIDO 등록/인증 절차와 공개키 방식의 장점
