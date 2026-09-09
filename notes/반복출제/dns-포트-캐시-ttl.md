---
title: DNS — 포트(53) · 전송 프로토콜 · 캐시 · TTL
domain: 애플리케이션보안
questions: [22-8, 29-7]
tags: [DNS, 포트53, UDP, TCP, DNS캐시, TTL]
---

**22·29회 반복 출제.** (A)(B)(C) 빈칸.

**핵심 정답**
- DNS는 **53번 포트**.
- **(A) 전송 프로토콜**: 일반 질의는 **UDP**(빠름, 512바이트 이하), Zone Transfer·512바이트 초과·EDNS0/DNSSEC 시 **TCP**.
- **(B) 캐시(DNS Cache)**: 재귀 서버가 결과를 저장해 상위 DNS 부하를 줄임.
- **(C) TTL (Time To Live)**: 각 레코드가 캐시에 유지되는 기간.

**함정**: TTL이 길면 캐시 포이즈닝 지속 시간도 길어짐. DNSSEC(레코드 서명), DoH/DoT(전송 암호화).
