---
title: Snort 룰 — content 위치 옵션(offset/depth), 룰 구조
domain: 네트워크보안
questions: [3-5, 7-4]
tags: [Snort, content, offset, depth, 룰구조]
---

**3·7회 반복 출제.** 룰 빈칸 (A)(B)(C).

**핵심 정답**
- Snort 룰 구조: `액션 프로토콜 출발지IP 출발지포트 -> 목적지IP 목적지포트 (옵션들)`.
- `content:"..."`: 페이로드 문자열/16진(`|FFFF|`) 탐지.
- `offset:9`: 검사 **시작 위치**(0부터 세어 10번째 바이트).
- `depth:2`: offset 지점부터 **검사할 범위**(2바이트).
- `msg:"..."`: 경고 메시지. `nocase`: 대소문자 무시.

**함정**: `offset`/`depth` = 페이로드 절대 위치, `distance`/`within` = 직전 content 매치로부터의 상대 위치.
