---
title: Cisco 라우터·스위치 보안 설정 · 패킷 필터링
domain: 네트워크보안
questions: [1-15, 2-1, 18-13, 20-15, 32-2]
tags: [Cisco, enable secret, ACL, ingress, egress, directed-broadcast, tiny fragment]
---

## 한 줄 정의

Cisco 보안 문제는 **① 접근 통제(패스워드·VTY·SNMP) → ② 공격별 방어 명령 → ③ ACL·필터링** 순서로 나온다. 명령어를 *읽고 의미를 설명*하거나 *빈칸에 채우는* 형태가 많다. {{1-15}} {{2-1}} {{18-13}} {{32-2}}

## 1. 관리 접근 통제

### 라우터 모드

| 모드 | 프롬프트 | 설명 |
|---|---|---|
| User EXEC | `Router>` | 기본 진입, 제한된 조회 |
| Privileged EXEC | `Router#` | 관리자 모드 (`enable` 로 진입) |
| Global Config | `Router(config)#` | 전역 설정 |
| Interface/Line Config | `Router(config-if)#` 등 | 인터페이스·라인 세부 설정 |

### 패스워드 {{1-15}}

```text
Router(config)# service password-encryption     # 평문 패스워드를 약한 암호화(Type 7)로
Router(config)# enable secret <PW>              # 특권 모드, MD5 해시(Type 5) — 권장
Router(config)# enable password <PW>            # 구식, 평문/Type 7
Router(config)# line vty 0 4
Router(config-line)# password <PW>
Router(config-line)# login                      # 또는 login local / transport input ssh
```

> [!함정] secret 과 password 가 함께 있으면
> **`enable secret` 이 우선**한다. secret 은 단방향 해시라 복호화가 안 되고, `service password-encryption`(Type 7)은 복호화 도구가 있는 **보조 수단**일 뿐이다.

### 콘솔 · VTY 원격 접근

```text
Router(config)# line console 0
Router(config-line)# login
Router(config-line)# password cisco

Router(config)# line vty 0 4                    # VTY 0~4 = 최대 5개 동시 원격 세션
Router(config-line)# login
Router(config-line)# password cisco

# 관리 IP 만 VTY 접속 허용
Router(config)# access-list 10 permit host [관리IP]
Router(config)# access-list 10 deny any
Router(config)# line vty 0 4
Router(config-line)# access-class 10 in
```

### SNMP 보안 4가지

```text
Router(config)# no snmp-server                          # ① 완전 비활성 (가장 강력)
Router(config)# snmp-server community [문자열] ro 11     # ② 기본 community 변경 + RO 만
Router(config)# access-list 11 permit host [관리IP]      # ③ ACL 로 IP 제한
Router(config)# access-list 11 deny any
Router(config)# interface FastEthernet 0/0
Router(config-if)# ip access-group 11 in
```

④ 가능하면 **SNMPv3** (인증 + 암호화)

> [!암기] 4가지 핵심
> 기본 community **변경** · **v3** 사용 · **ACL** 접근 제한 · **RW 제거**(RO 만)

## 2. 공격별 방어 명령

| 명령 | 막는 것 |
|---|---|
| `no ip directed-broadcast` | **Smurf** (브로드캐스트 릴레이 차단) |
| `no ip redirects` | ICMP Redirect 공격 |
| `no ip unreachables` | ICMP Unreachable 응답 차단 (정찰 차단) |
| `no ip source-route` (전역) | Source Route 옵션 악용 |
| `ip verify unicast reverse-path` | **Unicast RPF** — 출발지가 역방향 라우팅표와 일치하는지 검증 (스푸핑 방어) |

### Smurf 차단 라우터 설정 {{20-15}}

```text
Router(config)# access-list 100 permit udp 192.168.1.0 0.0.0.255 any
Router(config)# interface FastEthernet 0/0
Router(config-if)# ip directed-broadcast 100      # 신뢰 대역만 허용
Router(config-if)# no ip directed-broadcast        # 일반적으로는 전면 비활성
```

와일드카드 마스크 = 서브넷 마스크의 **비트 반전** (255.255.255.0 → 0.0.0.255)

## 3. ACL 과 필터링

### 사설 IP 스푸핑 차단

외부에서 사설 대역을 출발지로 위조한 패킷을 인바운드에서 막는다.

```text
Router(config)# access-list 15 deny 10.0.0.0 0.255.255.255       # A 클래스 사설
Router(config)# access-list 15 deny 172.16.0.0 0.15.255.255      # B 클래스 사설
Router(config)# access-list 15 deny 192.168.0.0 0.0.255.255      # C 클래스 사설
Router(config)# access-list 15 permit any
Router(config)# interface FastEthernet 0/0
Router(config-if)# ip access-group 15 in
```

### 확장 ACL 읽기 {{32-2}}

```text
ip access-list extended SERVICE_FILTER
 deny   tcp any any eq 23          # telnet 차단
 permit tcp any any eq www         # http(80) 허용
 permit udp any any eq snmp        # snmp(161) 허용
 deny   tcp any any eq 20
 deny   tcp any any eq ftp
```

- **위 → 아래 순차 평가**, 첫 매치에서 종료
- 끝에 **암묵적 `deny any`**
- "차단된 포트" 문제 → `deny` 항목 + permit 되지 않은 나머지 전부
- 표준 ACL(1~99)은 **출발지 IP 만**, 확장 ACL(100~199)은 출발지·목적지·프로토콜·포트

### Ingress · Egress · Blackhole {{2-1}} {{18-13}}

| 필터 | 위치 | 목적 |
|---|---|---|
| **Ingress** | 외부 → 내부 유입점 | 사설·비할당·내부 IP 를 출발지로 위장한 패킷 차단 (**BCP38**) |
| **Egress** | 내부 → 외부 유출점 | 출발지가 **우리 대역이 아닌** 패킷의 유출 차단 (우리 망이 DDoS 근원지가 되는 것 방지) |
| **Blackhole** (RTBH) | 라우터 | 공격 대상·근원 IP 를 `Null0` 로 라우팅해 폐기 |

존재하지 않는(비라우팅) 외부 IP 로 스푸핑한 패킷은 **Unicast RPF** 또는 Ingress ACL 로 막는다.

### Tiny Fragment 공격 {{18-13}}

TCP 헤더를 **첫 단편에 포트 번호가 들어가지 않을 만큼** 잘게 쪼개면, 헤더만 보고 판단하는 패킷 필터가 규칙을 적용하지 못하고 **통과**시킨다.

대응: ① 첫 단편의 최소 크기를 강제(포트까지 포함) ② 재조합 후 검사하는 **상태 기반 방화벽** ③ offset=1 인 단편 폐기

## 기출 포인트

> [!시험] 이렇게 나온다
> `enable secret` vs `enable password` · SNMP 보안 설정 4가지 · `no ip directed-broadcast` 의 목적 · ACL 해석(차단 포트 찾기) · Ingress / Egress 구분 · Tiny Fragment 원리
