---
title: DNS 보안 (설정 · Zone Transfer · 캐시 포이즈닝)
domain: 애플리케이션보안
questions: [5-16, 6-3, 7-3, 8-8, 11-4, 21-16, 22-8, 23-18, 26-3, 29-7, 31-2, 32-1, 17-2, 7-6]
tags: [DNS, named.conf, zone transfer, 캐시포이즈닝, 파밍, DNSSEC, wireshark]
---

## 기본

- 포트 **53** — 질의·응답은 **UDP**, Zone Transfer·512바이트 초과·DNSSEC은 **TCP**
- **재귀(Recursive/캐시) 서버**: 클라이언트 대신 최종 답을 찾음 (ISP·회사 내부)
- **책임(Authoritative) 서버**: 해당 도메인의 실제 레코드 보유 (Master/Slave)
- **캐시**로 상위 부하 감소, 각 레코드는 **TTL** 동안만 유효

## 설정 파일

| 파일 | 역할 |
|---|---|
| **named.conf** | 서버 설정 — 담당 zone(master/slave), zone 파일 경로, `allow-transfer` 등 |
| **zone 파일** | 실제 레코드 — SOA, NS, A, AAAA, CNAME, MX, PTR, SRV |
| **resolv.conf** | 클라이언트(리졸버) 설정 — `nameserver`, `search` |

```
# named.conf (Master)
zone "korea.co.kr" IN {
    type master;
    file "korea.co.kr.db";
    allow-transfer { 192.168.1.2; };   # Slave IP만 허용
};
# named.conf (Slave)
zone "korea.co.kr" IN {
    type slave;
    file "slave/korea.co.kr.db";
    masters { 192.168.1.1; };
};
```
SOA serial을 올려야 Slave가 갱신 감지.

## Zone Transfer (AXFR) 위협

- 정상: Slave가 Master에서 존 전체 복제
- 임의 허용 시: **내부 호스트명·IP·구조 통째 노출**(정찰), 반복 요청 시 DoS
- 대응: `allow-transfer` 로 Slave IP만, 불필요하면 비활성화, **TSIG**로 인증

## 도메인 변조 공격 3종 — 어디를 건드리나

| 공격 | 변조 지점 | 범위 | 판별 |
|---|---|---|---|
| **hosts 파일 변조(로컬 파밍)** | 피해자 PC `/etc/hosts`·`drivers\etc\hosts` | 그 PC만 | 악성코드 감염, hosts에 낯선 항목 |
| **DNS 스푸핑(LAN)** | 같은 네트워크에서 위조 응답을 먼저 보냄(ARP 스푸핑 병행) | LAN 구간 사용자 | LAN 내 중복·비정상 DNS 응답 |
| **캐시 포이즈닝(원격)** | 재귀(캐시) 서버의 캐시에 위조 레코드 주입 | 그 리졸버를 쓰는 **모든 사용자** | 정상 도메인이 낯선 IP로, TTL 동안 지속 |

- 셋 다 결과는 같다 — 정상 도메인 입력 시 **가짜 사이트로 유도(파밍)**. 차이는 변조 위치와 피해 범위.

## 캐시 포이즈닝 / 파밍 (17-2)

- **DNS 캐시 포이즈닝**: 재귀(캐시) 서버가 상위에 질의한 사이에, 공격자가 **정답보다 먼저** 위조 응답을 보내 캐시에 심는다. 성공 조건 = 트랜잭션 ID(16비트)·소스포트·질의명 일치.
- 고전: TXID·소스포트 예측(**Kaminsky**, 2008) — 서브도메인을 무작위로 질의해 시도 횟수를 늘림.
- **DNSSEC**: 존 데이터에 **전자서명(RRSIG)** 을 붙이고, 상위 존이 하위 존의 키 해시(**DS 레코드**)를 보증하는 **신뢰 체인**(root → TLD → 도메인)으로 응답 위조를 검출. 기밀성은 제공 안 함(암호화 아님).
- 그 밖 대응: 소스포트·TXID 랜덤화, 0x20 인코딩(대소문자 랜덤), 신뢰 리졸버 사용.

## 서술형 3줄 요약 답안

- **Zone Transfer 위협**: `allow-transfer` 미설정 시 누구나 AXFR로 존 전체(내부 호스트명·IP·구조)를 받아 정찰에 이용한다. **Slave IP만 허용**하고 **TSIG**로 인증한다.
- **DNS 캐시 포이즈닝**: 재귀 서버 캐시에 위조 레코드를 주입해 사용자를 가짜 사이트로 보내는(파밍) 공격이다. 대응은 **DNSSEC**(응답 전자서명 검증), TXID·소스포트 랜덤화.
- **DNS 증폭 DDoS**: 출발지를 피해자로 위조한 ANY/TXT 질의를 개방형 리졸버에 보내 증폭 응답을 피해자에게 쏟는다. 개방형 리졸버 차단·RRL·BCP38로 대응한다.

## Wireshark DNS 필터 (7-6)

| 목적 | 필터 |
|---|---|
| DNS 응답 패킷만 | `dns.flags.response == 1` |
| DNS 질의 패킷만 | `dns.flags.response == 0` |
| 특정 도메인 | `dns.qry.name == "www.example.com"` |
| 응답 코드 오류(NXDOMAIN 등) | `dns.flags.rcode != 0` |
| ANY 타입 질의(증폭 정찰) | `dns.qry.type == 255` |

## DNS 증폭 DDoS

출발지 IP 위조 + **ANY/TXT** 쿼리 → 개방형 리졸버가 증폭 응답을 피해자에게.
대응: 개방형 리졸버 차단, RRL(Response Rate Limiting), BCP38.
