---
title: Snort 룰 문법
domain: 네트워크보안
questions: [2-12, 3-5, 7-4, 11-15, 12-13, 13-14, 14-16, 17-15, 20-13, 22-6, 30-15, 4-14]
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

### offset/depth(절대) vs distance/within(상대)

```
페이로드:  [0]........[offset]===검사구간(depth)===........
2차 content:            [직전 매치]--distance--[검사시작]--within--
```
- `offset`/`depth` = 페이로드 **시작 기준 고정 위치**. 첫 content 위치 지정에.
- `distance`/`within` = **직전 content 매치 끝 기준**. 여러 패턴의 상대 순서·간격 지정에.
- 예: `content:"POST"; offset:0; depth:4; content:"/admin"; distance:0; within:20;`

## 실기 룰 작성 예제

```
# 1) 웹 디렉터리 트래버설 시도
alert tcp any any -> $HTTP_SERVERS 80 (msg:"Dir Traversal"; flow:to_server,established;
  content:"../"; http_uri; nocase; sid:1000010;)

# 2) SQL 인젝션 흔적 (UNION SELECT)
alert tcp any any -> $HTTP_SERVERS 80 (msg:"SQLi UNION"; flow:to_server,established;
  content:"union"; nocase; http_uri; content:"select"; nocase; distance:0; sid:1000011;)

# 3) GET Flooding — 같은 출발지가 10초에 100회 초과
alert tcp any any -> $HTTP_SERVERS 80 (msg:"HTTP GET Flooding"; flow:to_server,established;
  content:"GET"; offset:0; depth:3;
  detection_filter:track by_src, count 100, seconds 10; sid:1000012;)

# 4) 특정 악성코드 시그니처 (바이너리)
alert tcp any any -> any any (msg:"Malware Sig"; content:"|90 90 90 90 E8|"; sid:1000013;)
```

- 실기 채점 포인트: `flow:to_server,established`(정상 세션만 검사 → 성능·오탐↓), `http_uri`/`nocase`, `sid` ≥ 1000000, `detection_filter`(구 threshold)로 flooding 임계치.

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

## sid 범위 · 기타 옵션

| sid 범위 | 의미 |
|---|---|
| 1 ~ 99 | 예약(시스템 룰) |
| 100 ~ 999999 | 공식(Snort 커뮤니티) 룰 |
| 1000000 ~ | 사용자 정의 룰 |

`rev:N`(룰 버전), `classtype:공격분류`(예 `attempted-recon`), `priority:1`(1=최우선), `http_method`(HTTP 메서드 검사) 도 Rule Body 옵션.

## TCP flags 표기 (스캔 탐지 룰)

`S`=SYN `F`=FIN `SF`=SYN+FIN `!UAPRSF`=아무 플래그도 없음(**NULL 스캔**). Land Attack은 플래그가 아니라 `sameIP`(출발지=목적지 IP 동일) 옵션으로 탐지.

```
# SYN+FIN 스캔
alert tcp any any -> 10.10.10.0/24 any (msg:"SYNFIN Scan Detect"; flags:SF; sid:100240;)
# NULL 스캔
alert tcp any any -> 10.10.10.0/24 any (msg:"NULL Scan Detect"; flags:!UAPRSF; sid:100270;)
# Land Attack (출발지=목적지 동일 IP)
alert ip any any -> HOME_NET any (msg:"Land Attack SRC=DST Same IP"; sameIP; sid:100230;)
```

## 브루트포스 / 플러딩 탐지 실전 룰 (threshold 활용)

```
# Telnet 로그인 실패 문자열로 브루트포스 탐지 (5초에 1번만 경보 = limit)
alert tcp 10.10.10.0/24 23 -> any any (msg:"Telnet brute force"; content:"Login incorrect"; nocase;
  threshold: type limit, track by_dst, count 1, seconds 5; sid:1000120;)

# SSH 배너로 브루트포스 탐지 (30초 내 5회 중 첫 1회만 = both)
alert tcp any any -> 10.10.10.0/24 22 (msg:"SSH login brute force"; content:"SSH-2.0"; nocase;
  threshold: type both, track by_src, count 5, seconds 30; sid:1000150;)

# TCP SYN Flooding (1초 내 5회마다 경보 = threshold)
alert tcp any any -> 10.10.10.0/24 80 (msg:"TCP SYN Flooding"; flags:S;
  threshold: type threshold, track by_src, count 5, seconds 1; sid:1000170;)
```

## HeartBleed 탐지 룰 (13회15 기출)

```
alert tcp any any -> any [443,465,523]
  (content:"|18 03 00|"; depth:3;            # SSL 레코드 타입=0x18(Heartbeat), 버전 SSLv3
   content:"|01|"; distance:2; within:1;    # Heartbeat 메시지 타입=0x01(Request)
   content:!"|00|"; within:1;               # 길이 필드 상위 바이트가 0이 아님(비정상적으로 큰 요청)
   msg:"SSLv3 Malicious Heartbleed Request"; sid:1;)
```
'작은 하트비트 요청인데 유독 큰 응답을 요구'하는 비정상 패턴을 잡는 룰 — `depth`/`distance`/`within`의 실전 조합 예로도 자주 출제.

## 룰 작성 시 문제점 (30회)

- 너무 광범위/느슨 → **오탐(FP)**
- 너무 구체적/좁음 → **미탐(FN)**
- 비효율적 패턴(content 없이 pcre만) → 성능 저하·패킷 드롭
