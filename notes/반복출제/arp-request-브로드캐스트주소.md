---
title: ARP Request의 목적지 주소 = 브로드캐스트
domain: 네트워크보안
questions: [14-2, 22-7]
tags: [ARP, 브로드캐스트, ff:ff:ff:ff:ff:ff]
---

**14·22회 반복 출제.** 'ARP Request 시 목적지 주소를 형식에 맞게 쓰시오'.

**핵심 정답**: `FF:FF:FF:FF:FF:FF` (이더넷 브로드캐스트 MAC).

**이유**: ARP Request는 '이 IP의 MAC이 누구냐'를 묻는 것이므로 대상 MAC을 모른다 → 이더넷 프레임 목적지 MAC을 브로드캐스트로 설정해 세그먼트 전체에 전송. 해당 IP의 호스트만 **유니캐스트** ARP Reply.

**함정**: 이 브로드캐스트 특성 + 인증 부재가 [🔗 ARP 스푸핑 (MAC 위조 스니핑/MITM)](#/note/%EB%B0%98%EB%B3%B5%EC%B6%9C%EC%A0%9C%2Farp-%EC%8A%A4%ED%91%B8%ED%95%91)의 기반. Reply는 유니캐스트.
