---
title: IPsec — AH · ESP · 계층
domain: 네트워크보안
questions: [11-3, 12-2]
tags: [IPsec, AH, ESP, IKE, 3계층]
---

**11·12회 반복 출제.** VPN 프로토콜 빈칸.

**핵심 정답**
- **IPsec**: **네트워크(3) 계층** 보안 프로토콜.
- **AH (Authentication Header)**: 무결성·인증·재전송 방지. 기밀성(암호화) 없음. IP 헤더 일부까지 보호 → **NAT 통과 불가**.
- **ESP (Encapsulating Security Payload)**: 기밀성 + 무결성·인증. 실무는 대부분 ESP.
- 키 관리: **IKE** (UDP 500). 전송 모드(페이로드만) / 터널 모드(원본 IP까지 암호화, VPN 게이트웨이).

**왜**: AH는 무결성 계산 범위에 **IP 헤더(출발지·목적지 IP)** 를 포함한다. NAT가 그 IP를 바꾸면 수신 측 무결성 검증이 깨진다. ESP는 IP 헤더를 인증 범위에서 빼므로 NAT-T(UDP 4500 캡슐화)로 통과 가능.

**함정**: AH는 암호화 안 함. NAT 환경은 ESP + NAT-T(UDP 4500).
