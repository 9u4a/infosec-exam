---
title: Windows NetBIOS over TCP/IP 바인딩 취약점
domain: 시스템보안
questions: [23-15, 28-14]
tags: [NetBIOS, ncpa.cpl, WINS, 공유자원, 널세션]
---

**23·28회 반복 출제.** 취약 이유 + 보안 설정(ncpa.cpl 이용).

**핵심 정답**
- **취약 이유**: 인터넷에 직접 연결된 Windows에서 **NetBIOS over TCP/IP 바인딩**이 활성화되어 있으면 공격자가 **139/445 포트로 공유 자원 열거·접근, 널 세션** 등 원격 악용 가능.
- **설정 방법**: `ncpa.cpl` → 어댑터 속성 → **TCP/IPv4 → 고급 → WINS 탭 → 'NetBIOS over TCP/IP 사용 안 함'**.
- 병행: 방화벽에서 **139/445 차단**, 게스트 계정 비활성화, RestrictAnonymous.

**함정**: 설정 경로(WINS 탭)를 정확히. 널 세션 = 인증 없이 IPC$ 연결.
