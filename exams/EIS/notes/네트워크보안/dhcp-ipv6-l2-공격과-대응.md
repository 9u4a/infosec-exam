---
title: DHCP · IPv6 · L2 공격과 대응 (Starvation · Rogue DHCP · RA 스푸핑 · Port Security)
domain: 네트워크보안
questions: []
tags: [DHCP, DHCP스타베이션, RogueDHCP, DHCPSnooping, PortSecurity, IPv6, NDP, ICMPv6, RA스푸핑, RAGuard]
related: [네트워크보안/arp스푸핑-스니핑탐지, 네트워크보안/vlan-스위칭-nac-망분리, 네트워크보안/cisco-라우터-스위치-보안설정]
---

> 기준 시점: 2026-09 · Cisco IOS 명령 기준 (벤더마다 문법 다름).

## 한 줄 정의

같은 LAN(L2) 안에서는 **DHCP·ARP·IPv6 NDP 가 모두 인증 없이** 동작한다. 공격자는 이를 이용해 **주소를 고갈**시키거나 **가짜 게이트웨이·DNS 를 배포**해 중간자(MITM)가 된다. 대응은 스위치가 **신뢰 포트를 구분**하고 **포트당 단말을 제한**하는 것이다.

## DHCP 동작 (DORA)

UDP **67(서버) / 68(클라이언트)**. IP 가 없는 단말이 시작하므로 처음은 **브로드캐스트**다.

1. **Discover** — 단말: "DHCP 서버 있나요?" (브로드캐스트)
2. **Offer** — 서버: IP·게이트웨이·DNS 제안
3. **Request** — 단말: 그 주소 쓰겠다
4. **Ack** — 서버: 확정 (임대 시간 포함)

## DHCP 공격

| 공격 | 방법 | 결과 |
|---|---|---|
| **DHCP Starvation** (고갈) | 위조 MAC 으로 Discover/Request 대량 전송 | IP 풀 고갈 → 정상 단말 주소 못 받음 (DoS) |
| **Rogue DHCP** (DHCP 스푸핑) | 가짜 서버가 먼저 Offer 응답 | 공격자를 **게이트웨이·DNS** 로 지정 → MITM·파밍 |

- 보통 **Starvation 으로 정상 서버를 무력화 → Rogue DHCP** 순서로 묶어 쓴다
- 도구: Yersinia · DHCPig · Gobbler

## 대응 — 스위치 보안 기능

| 기능 | 막는 공격 | 원리 |
|---|---|---|
| **DHCP Snooping** | Rogue DHCP · Starvation | **trust** 포트에서만 Offer/Ack 허용, IP–MAC 바인딩 테이블 생성 |
| **DAI** (Dynamic ARP Inspection) | ARP 스푸핑 | Snooping 바인딩 테이블과 다른 ARP 응답 폐기 |
| **IP Source Guard** | IP 스푸핑 | 바인딩 테이블에 없는 출발지 IP 차단 |
| **Port Security** | MAC Flooding · Starvation | 포트당 허용 MAC 수·주소 제한 |
| **BPDU Guard · Root Guard** | STP 조작 (루트 브리지 탈취) | 단말 포트에서 BPDU 수신 시 차단 |

```
ip dhcp snooping
ip dhcp snooping vlan 10
ip arp inspection vlan 10
!
interface Gi0/1                      ! 정상 DHCP 서버·업링크 방향
 ip dhcp snooping trust
!
interface range Gi0/2 - 24           ! 사용자 포트
 switchport mode access
 switchport port-security
 switchport port-security maximum 2
 switchport port-security violation shutdown
 ip dhcp snooping limit rate 10
 spanning-tree bpduguard enable
```

| violation 모드 | 위반 프레임 | 로그·카운터 | 포트 |
|---|---|---|---|
| **protect** | 폐기 | 없음 | 유지 |
| **restrict** | 폐기 | **기록** | 유지 |
| **shutdown** (기본) | 폐기 | 기록 | **err-disabled** |

> [!함정] Snooping 켜면 기본이 전부 untrusted
> 정상 DHCP 서버·업링크 포트를 `trust` 로 지정하지 않으면 **정상 Offer 까지 차단**돼 전 단말이 주소를 못 받는다.

> [!함정] DAI·IP Source Guard 는 Snooping 에 의존
> 둘 다 **DHCP Snooping 바인딩 테이블**을 기준으로 판단한다. 고정 IP 단말은 별도 ARP ACL 이 필요하다.

## IPv6 NDP 공격

IPv6 에는 ARP·브로드캐스트가 없고 **NDP**(ICMPv6) 가 대신한다. 역시 인증이 없다.

| ICMPv6 타입 | 메시지 | 역할 |
|---|---|---|
| 133 | RS (Router Solicitation) | 라우터 찾기 |
| 134 | **RA** (Router Advertisement) | 프리픽스·**기본 게이트웨이** 광고 |
| 135 | NS (Neighbor Solicitation) | 주소 → MAC 질의 (ARP Request 대응) |
| 136 | NA (Neighbor Advertisement) | 응답 (ARP Reply 대응) |
| 137 | Redirect | 더 나은 경로 안내 |

| 공격 | 방법 | 대응 |
|---|---|---|
| **RA 스푸핑** | 가짜 RA 로 자신을 기본 게이트웨이로 광고 | **RA Guard** |
| **NA 스푸핑** | 위조 NA 로 이웃 캐시 오염 (ARP 스푸핑의 IPv6판) | ND Inspection · **SEND** |
| DAD DoS | 모든 중복주소검사(DAD)에 "사용 중" 응답 | ND Inspection |
| Rogue DHCPv6 | 가짜 DHCPv6 서버 | **DHCPv6 Guard** |

- **SEND**(Secure Neighbor Discovery, RFC 3971): CGA 주소 + RSA 서명으로 NDP 메시지 인증
- IPv4 만 막은 망도 단말은 IPv6 가 켜져 있다 → **IPv6 RA 로 우회 MITM** 가능 (미사용이면 비활성)

> [!함정] IPv6 = IPsec 필수?
> 초기 규격(RFC 4294)은 IPsec 지원 **필수**였으나 RFC 6434(2011)부터 **권고**로 바뀌었다. "IPv6 는 항상 암호화" 는 틀린 말이다.

## 기출 포인트

> [!시험] 이렇게 나온다
> DORA 4단계 · Starvation → Rogue DHCP 공격 흐름 · DHCP Snooping trust/untrusted 의미 · Port Security violation 3모드 · IPv6 RA/NA 스푸핑과 RA Guard · ICMPv6 NDP 메시지 매칭
