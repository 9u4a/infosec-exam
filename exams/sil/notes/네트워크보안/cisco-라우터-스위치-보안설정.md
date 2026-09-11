---
title: Cisco 라우터·스위치 보안 설정 · 패킷 필터링
domain: 네트워크보안
questions: [1-15, 2-1, 18-13, 20-15, 32-2]
tags: [Cisco, enable secret, ACL, ingress, egress, directed-broadcast, tiny fragment]
---

## 패스워드 설정 (1-15)

```
Router(config)# service password-encryption      # 설정파일 내 평문 패스워드를 약한 암호화(Type 7)로
Router(config)# enable secret <PW>                # 특권 모드 패스워드, MD5 해시(Type 5) — 권장
Router(config)# enable password <PW>              # 구식, 평문/Type7 — secret과 함께 있으면 secret 우선
Router(config)# line vty 0 4
Router(config-line)# password <PW>
Router(config-line)# login                        # 또는 login local / transport input ssh
```
- `enable secret` 은 단방향 해시라 복호화 불가 → `enable password` 보다 안전.
- `service password-encryption` 은 Type 7(취약, 복호화 툴 존재)이므로 보조 수단.

## SNMP 비활성화 (관련: 21-2)

```
Router(config)# no snmp-server            # SNMP 에이전트 전체 비활성화
```

## 확장 ACL 해석 (32-2)

```
ip access-list extended SERVICE_FILTER
 deny   tcp any any eq 23          # telnet 차단
 permit tcp any any eq www          # http(80) 허용
 permit udp any any eq snmp         # snmp(161) 허용
 permit tcp any any eq ftp          # 21 허용... (예시)
 deny   tcp any any eq 20
 deny   tcp any any eq ftp
```
- 위→아래 순차 평가, 첫 매치에서 종료, **끝에 암묵적 `deny any`**.
- "차단된 포트"를 묻는 문제 → `deny` 항목 + permit되지 않은 나머지 전부.
- 표준 ACL(1~99)은 출발지 IP만, 확장 ACL(100~199)은 출발지·목적지·프로토콜·포트.

## Ingress / Egress / Blackhole 필터링 (2-1, 18-13)

| 필터 | 위치 | 목적 |
|---|---|---|
| **Ingress 필터링** | 외부→내부 유입 지점 | 사설망 대역·비할당 IP·내부 IP를 출발지로 위장한 패킷 차단 (스푸핑 차단, BCP38) |
| **Egress 필터링** | 내부→외부 유출 지점 | 출발지가 우리 대역이 아닌 패킷 유출 차단 (우리 망이 반사·DDoS 근원지 되는 것 방지) |
| **Blackhole(Null 라우팅)** | 라우터 | 공격 대상/근원 IP를 `Null0` 로 라우팅해 트래픽 폐기 (RTBH) |

- 존재하지 않는(비라우팅) 외부 IP로 스푸핑한 패킷 → **Unicast RPF** 또는 Ingress ACL로 차단.

## Tiny Fragment 공격 (18-13)

- 이유: TCP 헤더를 **첫 단편에 포트 번호가 안 들어갈 만큼** 잘게 쪼개면, 헤더만 보고 판단하는 패킷 필터가 규칙을 적용 못 함 → 통과.
- 대응: ① 첫 단편의 최소 크기 강제(포트까지 포함) ② 재조합 후 검사하는 상태 기반 방화벽 ③ offset=1 인 단편 폐기.

## Smurf 차단 라우터 명령 (20-15)

```
Router(config)# access-list 100 permit udp 192.168.1.0 0.0.0.255 any
Router(config)# interface FastEthernet 0/0
Router(config-if)# ip directed-broadcast 100      # 신뢰 대역만 허용
Router(config-if)# no ip directed-broadcast        # (일반적으로는 전면 비활성)
```
- 와일드카드 마스크는 서브넷 마스크의 **비트 반전**(255.255.255.0 → 0.0.0.255).
