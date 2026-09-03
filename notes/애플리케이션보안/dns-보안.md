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

## 캐시 포이즈닝 / 파밍 (17-2)

- **DNS 캐시 포이즈닝**: 재귀(캐시) 서버의 캐시에 위조 레코드를 주입 → 정상 도메인 질의에 공격자 IP를 반환 → 사용자를 가짜 사이트로 유도(**파밍**).
- 고전: TXID·소스포트 예측(Kaminsky)
- 대응: **DNSSEC**(응답 전자서명), 소스포트·TXID 랜덤화, 0x20 인코딩, 신뢰 리졸버
- 유사어 구분: hosts 파일 변조 파밍(로컬), ARP 스푸핑 기반 DNS 스푸핑(LAN 구간).

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
