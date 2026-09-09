---
title: TCP SYN Flooding
domain: 네트워크보안
questions: [3-3, 5-3, 9-16]
tags: [SYNFlooding, 백로그큐, SYN쿠키, half-open]
---

**3·5·9회 반복 출제.** '백로그 큐 가득 + SYN_RECEIVED 다수 + 정상 접속 불가' 증상 지문 → 공격명.

**핵심 정답**
- 명칭: **TCP SYN Flooding**.
- 원리: SYN만 대량 전송 → 서버가 SYN+ACK 후 ACK를 기다리며 **half-open** 연결을 **백로그(SYN) 큐**에 쌓음 → 큐 고갈로 정상 연결 거부.
- 대응: **SYN 쿠키** (`net.ipv4.tcp_syncookies=1`), 백로그 큐 확대, 연결 타임아웃 단축, 방화벽 rate limit / SYN proxy.
- iptables(9회): `-p tcp --syn --dport 80 -m limit --limit 10/s -j ACCEPT` (초과분 DROP).

**함정**: 자원 소진형 DoS. 대역폭 소진형(UDP Flood 등)과 구분.
