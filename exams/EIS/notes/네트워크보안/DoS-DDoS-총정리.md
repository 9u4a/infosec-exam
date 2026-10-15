---
title: DoS · DDoS 공격 총정리
domain: 네트워크보안
questions: [2-8, 3-3, 3-8, 5-3, 6-15, 9-2, 9-16, 10-15, 15-3, 15-4, 15-15, 18-9, 26-8, 28-1, 32-15, 3-12, 3-15, 11-5, 23-16, 6-13, 7-11, 12-15, 13-4, 18-12, 18-16, 22-16, 27-18]
tags: [DoS, DDoS, Smurf, SYN Flooding, Slowloris, DRDoS, 증폭공격]
---

## 한 줄 정의

**DoS** 는 시스템·네트워크 **자원을 고갈**시켜 정상 서비스를 막는 공격이고, **DDoS** 는 다수의 좀비(봇넷)가 분산 수행하며, **DRDoS** 는 출발지 IP 를 피해자로 위조해 **개방 서버의 응답을 피해자에게 반사·증폭**시킨다. 공격마다 *무엇을 고갈시키는지* 로 구분하면 대응도 따라 외워진다. {{2-8}} {{3-3}} {{9-2}} {{15-3}} {{26-8}}

## 먼저 분류 — 무엇을 고갈시키나

| 고갈 대상 | 대표 공격 | 특징 |
|---|---|---|
| **네트워크 대역폭** | Smurf · DNS/NTP/Memcached 증폭 · UDP Flooding | 반사·증폭으로 회선을 채움 → **상류(ISP)** 에서 막아야 함 |
| **연결 테이블** (half-open) | SYN Flooding · Land | 소량 트래픽으로 **백로그 큐**만 채움, 대역폭은 멀쩡 |
| **소켓·커넥션** (established) | Slowloris · RUDY · Slow Read | 연결을 열어 두고 안 놓음 → 동시연결 한도 소진 |
| **서버 CPU·앱 자원** | HTTP GET Flooding · 캐시 우회 GET · 해시충돌 | 요청은 정상 형태, 처리 비용이 큼 → L7 에서 판별 |

> [!함정] 이렇게 속인다
> SYN Flooding 은 대역폭이 아니라 **연결 큐** 고갈이다. Slowloris 는 대량 트래픽이 아니라 **느린 소량**으로 커넥션을 점유한다.

### DoS · DDoS · DRDoS

| | 출발지 | 특징 |
|---|---|---|
| DoS | 단일 | |
| DDoS | 다수 좀비(봇넷) | 분산 |
| DRDoS {{18-12}} | 위조 + **반사 서버 경유** | 좀비 없이도 대량 트래픽, 출처 추적 곤란 |

## 프로토콜 취약점형 (자원 소모)

| 공격 | 원리 | 대응 |
|---|---|---|
| **SYN Flooding** | SYN 만 대량 → half-open 백로그 큐 고갈 | **SYN 쿠키** · 백로그 확대 · 타임아웃 단축 |
| **Land** | 출발지 IP = 목적지 IP → 자기 자신에게 응답 루프 | 동일 IP 패킷 차단 · OS 패치 |
| **Teardrop** | fragment offset 을 겹치게 조작 → 재조합 오류 | OS 패치 · 비정상 fragment 차단 |
| **Ping of Death** | 재조합 후 65535 바이트 초과 | OS 패치 |
| **Bonk / Boink** | offset 조작 변형 | 〃 |

### 왜 SYN 쿠키가 근본 대응인가

일반 TCP 는 SYN 을 받으면 **연결 정보를 큐에 먼저 할당**하고 SYN+ACK 후 ACK 를 기다린다(half-open). 공격자는 ACK 를 안 보내 큐를 채운다.

**SYN 쿠키**는 큐에 아무것도 저장하지 않고, 연결 상태를 **시퀀스 번호에 암호학적으로 인코딩**해 SYN+ACK 로 돌려보낸다. 정상 클라이언트가 그 번호+1 을 ACK 로 돌려줘야 비로소 연결을 만든다. → **저장 공간을 쓰지 않으니 큐 고갈이 원천 차단**된다.

그 외: `tcp_max_syn_backlog` 확대 · `tcp_synack_retries` 축소 · 방화벽 SYN proxy

## 증폭 · 반사형 (DRDoS)

출발지 IP 를 **피해자로 위조**한 요청을 개방 서버에 보내면, 서버가 큰 응답을 피해자에게 보낸다.

| 공격 | 포트 | 증폭 유발 | 증폭률 |
|---|---|---|---|
| **Smurf** | ICMP | 위조 Echo 를 **브로드캐스트**로 | 브로드캐스트 도메인 호스트 수 |
| **DNS 증폭** | UDP 53 | **ANY / TXT** 질의 | 28~54배 |
| **NTP 증폭** | UDP 123 | **monlist** (최근 접속 IP 600개) | ~556배 |
| **SSDP 증폭** | UDP 1900 | UPnP M-SEARCH (IoT·공유기 악용) | ~30배 |
| **Memcached** | UDP 11211 | stats/get 대용량 캐시 | 최대 ~51,000배 |

**왜 스푸핑 + 반사인가:** ① 출처 추적이 어렵고 ② UDP 는 인증이 없어 위조가 쉽고 ③ 좀비 없이도 대량 트래픽이 나온다.

**공통 대응:** BCP38(출발지 검증) · **Unicast RPF** · 개방형 리졸버 차단 · `no ip directed-broadcast` · RRL · 대용량 응답 차단

> [!시험] Unicast RPF
> 라우터가 수신 패킷의 **출발지 IP 로 역경로**를 조회해, 들어온 인터페이스와 맞지 않으면 스푸핑으로 보고 폐기한다.

### Smurf 세부 {{7-11}}

- 원리: 출발지를 피해자로 위조한 **ICMP Echo Request** 를 증폭망 **브로드캐스트 주소**로 전송 → 그 망 호스트 전체가 피해자에게 Echo Reply
- 방화벽·IDS 없이 방어:
  - 라우터: `no ip directed-broadcast`
  - 호스트: 브로드캐스트 ICMP 에 응답 안 하게 — `net.ipv4.icmp_echo_ignore_broadcasts=1` (Solaris `ndd ... ip_forward_directed_broadcasts 0`)

### NTP 증폭 대응 4가지 {{12-15}} {{27-18}}

1. NTP 를 **4.2.8 이상**으로 업그레이드 (monlist 제거)
2. 불가하면 `ntp.conf` 에 `disable monitor`
3. 대상 서버가 monlist(`ntpdc -c monlist`)에 응답하는지 점검
4. iptables/ACL 로 신뢰 대역만 UDP 123 허용, 개방형 NTP 차단

### DNS 증폭 · 로그 판별 {{6-13}} {{18-16}} {{22-16}}

- 특징: 동일 트랜잭션 ID 로 **ANY 타입** 질의 대량 · 출발지가 피해자 IP 로 위조 · 여러 국가의 개방형 DNS 경유
- ANY 를 쓰는 이유: A·AAAA·MX·TXT·NS 등 **모든 레코드가 한 번에 반환**돼 증폭률이 가장 크다
- 대응: 권한 없는 재귀질의 차단(`allow-recursion`) · ANY 응답 제한(RFC 8482) · RRL · Unicast RPF

### Memcached 증폭 {{13-4}}

GitHub 2018 년 **1.35Tbps** 공격에 악용됐다. UDP 11211 이 열린 Memcached 에 작은 요청 → 최대 5만 배 응답.
대응: UDP 비활성(`-U 0`) · 11211 외부 차단 · 인증(SASL)

## L7 (애플리케이션) DoS

| 공격 | 원리 | 대응 |
|---|---|---|
| **HTTP GET Flooding** | 대량 GET → 세션·처리 자원 소진 | 임계치 차단 · 동일 URL 반복 차단 · CAPTCHA |
| **GET + Cache-Control** | `no-cache`/`max-age=0` 로 캐시 우회 → 원본 서버 부하 | CDN 우회 탐지 · L7 방어 |
| **Slowloris** | HTTP **헤더**를 미완성으로 느리게 전송 | 헤더 타임아웃 · 동시연결 제한 |
| **Slow Read** | TCP 윈도우를 0 에 가깝게 해 응답을 질질 끌게 함 | 커넥션 타임아웃 |

### RUDY (Slow POST) {{15-15}}

`Content-Length: 1000000` 처럼 큰 본문을 예고한 뒤 **본문을 1바이트씩** 느리게 보낸다. 서버는 수신이 끝날 때까지 세션을 유지하다 자원이 소진된다.

- 대응: Read/Connection **타임아웃 단축** · 동일 IP 동시연결 수 제한(iptables) · 최소 전송률 강제 · 역방향 프록시 버퍼링

## 기출 포인트

> [!암기] 서술형 3줄 답안
> - **DoS** 는 자원 고갈, **DDoS** 는 봇넷 분산, **DRDoS** 는 출발지를 피해자로 위조해 개방 서버(DNS·NTP)의 응답을 반사·증폭한다.
> - 대응은 계층별 — 대역폭은 **상류 ISP·클린존·CDN**, 연결 큐는 **SYN 쿠키**, 느린 공격은 **타임아웃·동시연결 제한**, L7 은 **임계치·CAPTCHA·WAF**.
> - 반사·증폭의 근본 대응은 **출발지 IP 검증(BCP38 / Unicast RPF)** 과 **개방형 리졸버·monlist 차단**.

> [!시험] 이렇게 나온다
> 공격 이름 ↔ 원리 매칭 · 증폭 공격의 포트·트리거 · NTP 대응 4가지 · SYN 쿠키가 큐 고갈을 막는 이유 · RUDY 와 Slowloris 구분
