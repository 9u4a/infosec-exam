---
title: Snort 룰 문법
domain: 네트워크보안
questions: [2-12, 3-5, 7-4, 11-15, 12-13, 13-14, 14-16, 17-15, 20-13, 22-6, 30-15]
tags: [Snort, IDS, IPS, content, threshold, PCRE]
---

## 룰 구조

```
액션  프로토콜  출발지IP 출발지포트  방향  목적지IP 목적지포트  ( 옵션 ; 옵션 ; ... )
alert  tcp      any      any       ->    any      80        (msg:"..."; content:"..."; sid:1000001;)
```

- **액션**: `alert`(경고+로깅) · `log` · `pass` · `drop`(폐기+로깅, IPS) · `reject`(폐기+RST/ICMP, IPS) · `sdrop`
- **방향**: `->` 단방향 · `<>` 양방향
- 목적지를 `any any`로 두면 모든 패킷 검사 → **성능 저하** (웹 서버 IP·포트 80으로 명시)

## 주요 옵션

| 옵션 | 의미 |
|---|---|
| `msg:"텍스트"` | 탐지 시 기록할 메시지 |
| `sid:숫자` | 룰 고유 식별자 (로컬 룰은 1,000,000 이상) |
| `content:"문자열"` | 페이로드 패턴 (16진: `content:"\|FF FF\|"`) |
| `nocase` | 대소문자 무시 |
| `offset:N` | 검사 시작 위치 (0부터, **절대**) |
| `depth:N` | offset부터 검사할 범위 (**절대**) |
| `distance:N` | 직전 매치 끝에서 N바이트 뒤부터 (**상대**) |
| `within:N` | 직전 매치 끝에서 N바이트 이내 (**상대**) |
| `pcre:"/정규식/i"` | 정규식 (느림 → content로 1차 필터 후 사용, `fast_pattern`) |
| `flow:to_server,established` | 방향·세션 상태 |
| `flags:S` | TCP 플래그 (S/F/R/A/P/U) |

예: `content:"GET"; offset:0; depth:3;` → 페이로드 앞 3바이트에 "GET"

## threshold / detection_filter

```
threshold: type <limit|threshold|both>, track <by_src|by_dst>, count N, seconds S;
```

| type | 동작 |
|---|---|
| **limit** | 시간창 내 처음 N번까지만 알림 |
| **threshold** | N번마다 1회 알림 (N, 2N, 3N…) |
| **both** | 시간창 내 N번 도달 시 딱 1회만 |

대량 트래픽(flooding)에서 경보 폭주 억제용.

## 룰 작성 시 문제점 (30회)

- 너무 광범위/느슨 → **오탐(FP)**
- 너무 구체적/좁음 → **미탐(FN)**
- 비효율적 패턴(content 없이 pcre만) → 성능 저하·패킷 드롭
