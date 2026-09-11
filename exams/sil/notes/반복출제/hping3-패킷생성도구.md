---
title: hping3 (패킷 생성·분석 도구, 살바토레 산필리포)
domain: 네트워크보안
questions: [23-8, 32-8]
tags: [hping3, 패킷생성, DoS모의훈련, 방화벽점검]
---

**23·32회 반복 출제.** '살바토레 산필리포(Salvatore Sanfilippo)가 개발, TCP/UDP/ICMP 패킷 생성, DDoS 모의훈련' → hping3.

**핵심 정답**: **hping3** (hping)
- TCP/UDP/ICMP/RAW-IP 패킷을 플래그·포트·크기·전송률·**출발지 위조**까지 옵션으로 조립해 전송.
- 용도: **방화벽 룰 점검**, 스텔스 포트 스캔, SYN/ICMP/UDP flooding 등 **DoS 모의훈련**.

**함정**: 같은 개발자가 Redis도 만듦(문제 힌트로 종종 등장). nmap(스캐너)·Scapy(파이썬 패킷 조립)와 구분.
