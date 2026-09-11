---
title: LAN 스위칭 방식 3가지 — Cut-through / Fragment-Free / Store-and-Forward
domain: 네트워크보안
questions: [24-3, 30-7]
tags: [LAN스위칭, CutThrough, StoreAndForward, FragmentFree]
---

**24·30회 반복 출제.** 3가지 나열(30회) 또는 (A)(B)(C) 설명 매칭(24회).

**핵심 정답**
- **Cut-through**: 목적지 MAC(**앞 6바이트**)만 읽고 즉시 전달 → 최저 지연, 오류·런트 프레임도 통과.
- **Fragment-Free (Modified Cut-through)**: **앞 64바이트**까지 읽어 충돌로 깨진 런트 프레임만 필터(절충).
- **Store-and-Forward**: **전체 프레임 수신 + FCS(CRC) 검사** 후 전달 → 오류 프레임 폐기, 지연 최대.

**함정**: '헤더만 보고' = Cut-through, '앞 64바이트' = Fragment-Free, '전체 다 받고' = Store-and-Forward.
