---
title: Snort 룰 분석 — GET Flooding / threshold / content 옵션
domain: 네트워크보안
questions: [2-12, 17-15]
tags: [Snort, 룰문법, threshold, nocase, content, byd st]
---

**2·17회 반복 출제.** GET Flooding Snort 룰의 각 옵션 의미를 서술.

{{2-12}} {{17-15}}

> [!암기] 핵심 정답
> - `msg:"GET Flooding"`: 탐지 시 기록할 **경고 메시지명**.
> - `content:"GET / HTTP1."`: 페이로드에 해당 **문자열 포함** 여부 검사.
> - `nocase`: **대소문자 구분 없이** 매칭.
> - `depth:13`: 페이로드 **앞 13바이트** 안에서만 검사.
> - `threshold: type threshold, track by_dst, count 10, seconds 1`: **목적지 IP 기준 1초 동안 10번째 이벤트마다** alert(폭주 억제).
> - `content:!"anonymous"`: 해당 문자열이 **없을 때** 매칭. `content:"|00|"`: 16진 바이트 `0x00`.

> [!팁] 기출 해설 표현 vs 실제 (17회)
> 17-15 해설은 `content:"|00|";depth:1` 을 "앞선 패턴 종료 지점부터 1바이트"로 풀이한다.
> 실제 depth 는 절대 위치라 페이로드 첫 1바이트를 본다. 답안은 해설 표현을 따르되 차이를 알아 둔다.

> [!함정] 함정
> `offset`/`depth`는 절대 위치, `distance`/`within`은 직전 매치 상대 위치. → [🔗 Snort 룰 — content 위치 옵션(offset/depth), 룰 구조](#/note/%EB%B0%98%EB%B3%B5%EC%B6%9C%EC%A0%9C%2Fsnort-%EB%A3%B0-content-offset-depth)
