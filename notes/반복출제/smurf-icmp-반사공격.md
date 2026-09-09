---
title: Smurf (ICMP 브로드캐스트 반사·증폭 DoS)
domain: 네트워크보안
questions: [2-8, 7-11, 9-2, 10-15, 28-1]
tags: [Smurf, ICMP, DirectedBroadcast, 반사공격]
---

**2·7·9·10·28회 반복 출제.** 명칭·과정·대응·반사서버 방지로 변주.

**핵심 정답**
- 원리: 공격자가 **출발지 IP를 피해자로 위조**한 `ICMP Echo Request`를 서브넷 **브로드캐스트 주소**로 전송 → 그 네트워크 전 호스트가 피해자에게 `ICMP Echo Reply` 폭주(반사·증폭 DoS).
- 대응(방화벽 없이도): ① 라우터에서 외부 유입 **Directed Broadcast 차단** (`no ip directed-broadcast`) ② 호스트가 브로드캐스트로 온 **ICMP Echo Request에 응답 안 함** (`net.ipv4.icmp_echo_ignore_broadcasts=1`) ③ 출발지 위조 차단(ingress filtering, BCP38).

**함정**: (B)(C) 빈칸은 각각 **Directed Broadcast** / **ICMP Echo Request** 패킷. Fraggle(UDP 버전)과 구분.
