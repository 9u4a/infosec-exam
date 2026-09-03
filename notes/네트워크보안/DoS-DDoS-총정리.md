---
title: DoS · DDoS 공격 총정리
domain: 네트워크보안
questions: [2-8, 3-3, 3-8, 5-3, 6-15, 9-2, 9-16, 10-15, 15-3, 15-4, 18-9, 26-8, 28-1, 32-15, 3-12, 3-15, 11-5, 23-16, 6-13, 7-11, 12-15, 13-4, 18-12, 18-16, 22-16, 27-18]
tags: [DoS, DDoS, Smurf, SYN Flooding, Slowloris, DRDoS, 증폭공격]
---

## 자원 소모형 (프로토콜 취약점)

| 공격 | 원리 | 대응 |
|---|---|---|
| **SYN Flooding** | SYN만 대량 → half-open 백로그 큐 고갈 | **SYN 쿠키**, 백로그 확대, 타임아웃 단축 |
| **Land** | 출발지 IP = 목적지 IP → 자기 자신에 응답 루프 | 동일 IP 패킷 차단, OS 패치 |
| **Teardrop** | fragment offset 겹치게 조작 → 재조합 오류 | OS 패치, 비정상 fragment 차단 |
| **Ping of Death** | 재조합 후 65535바이트 초과 | OS 패치 |
| **Bonk / Boink** | offset 조작 변형 | 〃 |

## 증폭 · 반사형 (DRDoS) — 출발지 IP를 피해자로 위조

| 공격 | 프로토콜/포트 | 증폭 유발 |
|---|---|---|
| **Smurf** | ICMP | 피해자 IP로 위조한 Echo Request를 **브로드캐스트**로 → 호스트들이 피해자에 Reply |
| **DNS 증폭** | UDP 53 | **ANY / TXT** 쿼리 (요청 대비 응답 수십~수백 배) |
| **NTP 증폭** | UDP 123 | **monlist** (최근 접속 IP 600개 반환) |
| **SSDP 증폭** | UDP 1900 | UPnP M-SEARCH, IoT·공유기 악용 |
| **Memcached** | UDP 11211 | 대용량 캐시 반사 (최대 5만 배, GitHub 2018) |

**왜 IP 스푸핑 + 반사인가**: ①출처 추적 곤란 ②UDP는 인증 없어 위조 쉬움 ③좀비 없이도 대량 트래픽.
**대응**: BCP38(출발지 검증, Unicast RPF), 개방형 리졸버 차단, `no ip directed-broadcast`, RRL, 대용량 응답 패킷 차단.

### Smurf 세부 (7-11)

- 원리: 출발지 IP를 피해자로 위조한 **ICMP Echo Request** 를 증폭망 **브로드캐스트 주소**로 전송 → 그 망의 모든 호스트가 피해자에게 Echo Reply.
- 방화벽/IDS 없이 방어: 라우터에서 `no ip directed-broadcast`(브로드캐스트→유니캐스트 변환 차단), 호스트에서 브로드캐스트 주소로 온 ICMP에 응답 안 하도록 커널 설정(`net.ipv4.icmp_echo_ignore_broadcasts=1`, Solaris `ndd ... ip_forward_directed_broadcasts 0`).

### NTP 증폭 대응 4가지 (12-15, 27-18)

① NTP를 **4.2.8 이상**으로 업그레이드(monlist 제거) ② 불가 시 `ntp.conf` 에 `disable monitor` ③ 대상 NTP 서버가 monlist(`ntpdc -c monlist`)에 응답하는지 점검 ④ iptables/ACL로 신뢰 대역만 UDP 123 허용, 개방형 NTP 차단.

### DNS 증폭 / DRDoS 로그 판별 (6-13, 18-16, 22-16)

- 특징: 동일 트랜잭션 ID로 **ANY 타입** 질의가 대량, 출발지가 피해자 IP로 위조, 여러 국가의 개방형 DNS 경유.
- ANY를 쓰는 이유: A·AAAA·MX·TXT·NS 등 **모든 레코드가 한 번에 반환**되어 증폭률이 가장 큼.
- 대응: 권한 없는 재귀질의 차단(`allow-recursion`), ANY 응답 제한/거부(RFC 8482), RRL(Response Rate Limiting), Unicast RPF.

### DRDoS vs DoS (18-12)

- DRDoS: 출발지 위조 + **반사 서버 경유** → 좀비 없이도 대량 트래픽, 출처 추적 곤란.
- **Unicast RPF**: 라우터가 수신 패킷의 출발지 IP로 **역경로(리턴 경로)** 를 조회해, 들어온 인터페이스와 일치하지 않으면 스푸핑으로 보고 폐기.

### Memcached 증폭 (13-4)

GitHub 2018년 1.35Tbps 공격에 악용. UDP 11211 개방된 Memcached에 작은 요청 → 최대 5만 배 응답.
대응: UDP 비활성(`-U 0`), 11211 외부 차단, 인증(SASL).

## L7 (애플리케이션) DoS

| 공격 | 원리 | 대응 |
|---|---|---|
| **HTTP GET Flooding** | 대량 GET → 세션·처리 자원 소진 | 임계치 차단, 동일 URL 반복 차단, CAPTCHA |
| **GET Flooding + Cache-Control** | `no-cache`/`max-age=0`로 캐시 우회 → 원본 서버 부하 | CDN 우회 탐지, L7 방어 |
| **Slowloris** | HTTP **헤더** 미완성, 느리게 전송 → 커넥션 점유 | 헤더 타임아웃, 동시연결 제한 |
| **RUDY (Slow POST)** | 큰 `Content-Length` 예고 후 본문 1바이트씩 | read 타임아웃, 최소 전송률 |
| **Slow Read** | TCP 윈도우 0으로 응답을 질질 끌게 | 커넥션 타임아웃 |

## DoS vs DDoS

- DoS: 단일 출발지. DDoS: 다수의 좀비(봇넷)에서 분산.
- DRDoS: 반사 서버를 경유 → 봇넷 없이도 분산 효과 + 출처 은닉.
