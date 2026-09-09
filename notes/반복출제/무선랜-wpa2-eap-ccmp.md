---
title: 무선랜 보안 표준 — WPA2 (EAP + AES-CCMP)
domain: 네트워크보안
questions: [18-1, 24-4]
tags: [WPA2, CCMP, EAP, WEP, WPA3]
---

**18·24회 반복 출제.** 'EAP 인증 + AES-CCMP 암호화 무선랜 표준은?'

**핵심 정답**: **WPA2**
- **WEP**: RC4 + 24bit IV → IV 재사용으로 수분 내 크랙(폐기).
- **WPA**: TKIP(RC4 기반, 키 자동 갱신) — 과도기.
- **WPA2**: **CCMP (AES-CTR + CBC-MAC)** 암호화 + 802.1X/EAP(엔터프라이즈) 또는 PSK(개인).
- **WPA3**: **SAE(Dragonfly)** 핸드셰이크로 오프라인 사전공격 방어, PMF 강제.

**함정**: WPA2-PSK는 4-way handshake 캡처 후 오프라인 사전공격·KRACK에 취약.
