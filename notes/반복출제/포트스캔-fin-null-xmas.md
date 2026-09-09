---
title: 스텔스 스캔 — 닫힌 포트만 응답(FIN/NULL/XMAS)
domain: 네트워크보안
questions: [4-8, 27-6]
tags: [포트스캔, FINScan, NULLScan, XMASScan, 스텔스스캔]
---

**4·27회 반복 출제.** '포트가 닫혀 있을 때만 응답이 오는 스캔 방식을 고르시오'.

**핵심 정답**: **FIN Scan, XMAS Scan, NULL Scan**
- RFC 793에 따르면 **닫힌 포트는 RST 응답, 열린 포트는 무응답** → '응답이 오면 닫힘'.
- FIN(FIN만) / NULL(플래그 없음) / XMAS(FIN+PSH+URG).
- SYN 스캔은 열린 포트에 SYN+ACK. Decoy 스캔은 위장 IP를 섞는 은폐 기법(응답 방식이 다름).

**함정**: **Windows는 RFC를 안 지켜** 열림·닫힘 모두 RST → 구분 불가(역으로 OS 추정에 이용).
