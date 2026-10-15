---
title: Snort 룰 문법
domain: 네트워크보안
questions: [2-12, 3-5, 7-4, 11-15, 12-13, 13-14, 14-16, 17-15, 20-13, 22-6, 30-15, 4-14]
tags: [Snort, IDS, IPS, content, threshold, PCRE]
---

## 한 줄 정의

**Snort 룰**은 `헤더(어떤 패킷을) + 옵션(무엇을 보고 어떻게 알릴지)` 으로 이뤄진다. 실기는 **룰을 읽어 의미를 쓰거나, 조건에 맞는 룰을 직접 작성**하게 하며, 핵심은 `content` 위치 옵션과 `threshold` 다. {{2-12}} {{3-5}} {{7-4}} {{13-14}} {{22-6}} {{30-15}}

## 룰 구조

```text
액션  프로토콜  출발지IP 출발지포트  방향  목적지IP 목적지포트  ( 옵션 ; 옵션 ; ... )
alert  tcp      any      any       ->    any      80        (msg:"..."; content:"..."; sid:1000001;)
```

| 구성 | 값 |
|---|---|
| **액션** | `alert`(경고+로깅) · `log` · `pass` · `drop`(폐기+로깅, IPS) · `reject`(폐기+RST/ICMP, IPS) · `sdrop` |
| **방향** | `->` 단방향 · `<>` 양방향 |

> [!팁] 목적지를 any any 로 두지 말 것
> 모든 패킷을 검사해 **성능이 떨어진다.** 웹 서버 IP·포트 80 처럼 명시한다.

## 주요 옵션

| 옵션 | 의미 |
|---|---|
| `msg:"텍스트"` | 탐지 시 기록할 메시지 |
| `sid:숫자` | 룰 고유 ID |
| `content:"문자열"` | 페이로드 패턴 (16진: `content:"\|FF FF\|"`) |
| `nocase` | 대소문자 무시 |
| `pcre:"/정규식/i"` | 정규식 (느림 → content 로 1차 필터 후 사용) |
| `flow:to_server,established` | 방향·세션 상태 |
| `flags:S` | TCP 플래그 (S/F/R/A/P/U) |

### content 위치 지정 — 절대 vs 상대

| 구분 | 옵션 | 기준 | 의미 |
|---|---|---|---|
| **절대** | `offset:N` | 페이로드 **시작** | 검사 시작 위치 (0부터) |
| **절대** | `depth:N` | offset 부터 | 검사할 범위 |
| **상대** | `distance:N` | **직전 매치 끝** | N바이트 뒤부터 검사 |
| **상대** | `within:N` | 직전 매치 끝 | N바이트 이내 |

```text
content:"GET"; offset:0; depth:3;                                   # 앞 3바이트에 "GET"
content:"POST"; offset:0; depth:4; content:"/admin"; distance:0; within:20;
```

> [!함정] offset/depth 와 distance/within 을 섞지 말 것
> 첫 content 의 위치는 offset/depth 로, **두 번째 이후 패턴의 순서·간격**은 distance/within 으로 지정한다.

## 실기 룰 작성 예제

```text
# 1) 웹 디렉터리 트래버설
alert tcp any any -> $HTTP_SERVERS 80 (msg:"Dir Traversal"; flow:to_server,established;
  content:"../"; http_uri; nocase; sid:1000010;)

# 2) SQL 인젝션 (UNION SELECT)
alert tcp any any -> $HTTP_SERVERS 80 (msg:"SQLi UNION"; flow:to_server,established;
  content:"union"; nocase; http_uri; content:"select"; nocase; distance:0; sid:1000011;)

# 3) GET Flooding — 같은 출발지가 10초에 100회 초과
alert tcp any any -> $HTTP_SERVERS 80 (msg:"HTTP GET Flooding"; flow:to_server,established;
  content:"GET"; offset:0; depth:3;
  detection_filter:track by_src, count 100, seconds 10; sid:1000012;)

# 4) 바이너리 시그니처
alert tcp any any -> any any (msg:"Malware Sig"; content:"|90 90 90 90 E8|"; sid:1000013;)
```

> [!시험] 채점 포인트
> `flow:to_server,established`(정상 세션만 검사 → 성능↑·오탐↓) · `http_uri` · `nocase` · `sid` ≥ 1000000 · flooding 은 `detection_filter`(구 threshold)

### sid 범위

| 범위 | 의미 |
|---|---|
| 1 ~ 99 | 예약 (시스템 룰) |
| 100 ~ 999999 | 공식(커뮤니티) 룰 |
| **1000000 ~** | 사용자 정의 룰 |

그 밖의 옵션: `rev:N`(룰 버전) · `classtype:`(예 `attempted-recon`) · `priority:1`(1=최우선) · `http_method`

## threshold — 경보 폭주 억제

```text
threshold: type <limit|threshold|both>, track <by_src|by_dst>, count N, seconds S;
```

| type | 동작 |
|---|---|
| **limit** | 시간창 내 **처음 N번까지만** 알림 |
| **threshold** | **N번마다 1회** 알림 (N, 2N, 3N…) |
| **both** | 시간창 내 N번 도달 시 **딱 1회만** |

## 스캔·플러딩·브루트포스 탐지 룰

### TCP flags 표기

| 표기 | 의미 |
|---|---|
| `S` / `F` / `SF` | SYN / FIN / SYN+FIN |
| `!UAPRSF` | 아무 플래그도 없음 = **NULL 스캔** |
| `sameIP` | 출발지=목적지 IP (Land Attack 은 플래그가 아니라 이 옵션) |

```text
alert tcp any any -> 10.10.10.0/24 any (msg:"SYNFIN Scan Detect"; flags:SF; sid:100240;)
alert tcp any any -> 10.10.10.0/24 any (msg:"NULL Scan Detect"; flags:!UAPRSF; sid:100270;)
alert ip any any -> HOME_NET any (msg:"Land Attack SRC=DST Same IP"; sameIP; sid:100230;)
```

### threshold 활용

```text
# Telnet 로그인 실패 — 5초에 1번만 경보 (limit)
alert tcp 10.10.10.0/24 23 -> any any (msg:"Telnet brute force"; content:"Login incorrect"; nocase;
  threshold: type limit, track by_dst, count 1, seconds 5; sid:1000120;)

# SSH 브루트포스 — 30초 내 5회 중 첫 1회 (both)
alert tcp any any -> 10.10.10.0/24 22 (msg:"SSH login brute force"; content:"SSH-2.0"; nocase;
  threshold: type both, track by_src, count 5, seconds 30; sid:1000150;)

# SYN Flooding — 1초 내 5회마다 경보 (threshold)
alert tcp any any -> 10.10.10.0/24 80 (msg:"TCP SYN Flooding"; flags:S;
  threshold: type threshold, track by_src, count 5, seconds 1; sid:1000170;)
```

## Heartbleed 탐지 룰 {{13-14}}

```text
alert tcp any any -> any [443,465,523]
  (content:"|18 03 00|"; depth:3;            # 레코드 타입 0x18(Heartbeat), 버전 SSLv3
   content:"|01|"; distance:2; within:1;     # Heartbeat 타입 0x01(Request)
   content:!"|00|"; within:1;                # 길이 상위 바이트가 0 이 아님 (비정상적으로 큰 요청)
   msg:"SSLv3 Malicious Heartbleed Request"; sid:1;)
```

"작은 하트비트 요청인데 큰 응답을 요구"하는 비정상 패턴을 잡는다. `depth` · `distance` · `within` 실전 조합 예로도 출제된다.

## 룰 작성의 문제점 {{30-15}}

| 문제 | 결과 |
|---|---|
| 너무 광범위·느슨 | **오탐** (FP) |
| 너무 구체적·좁음 | **미탐** (FN) |
| content 없이 pcre 만 | 성능 저하·패킷 드롭 |

## 기출 포인트

> [!시험] 이렇게 나온다
> 룰 한 줄 해석 · 조건에 맞는 룰 작성 · offset/depth vs distance/within · threshold 3 type 구분 · 스캔별 flags(NULL·SYN+FIN) · sid 범위
