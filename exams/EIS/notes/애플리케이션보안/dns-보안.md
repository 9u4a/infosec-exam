---
title: DNS 보안 (설정 · Zone Transfer · 캐시 포이즈닝)
domain: 애플리케이션보안
questions: [5-16, 6-3, 7-3, 8-8, 11-4, 21-16, 22-8, 23-18, 26-3, 29-7, 31-2, 32-1, 17-2, 7-6]
tags: [DNS, named.conf, zone transfer, 캐시포이즈닝, 파밍, DNSSEC, wireshark]
---

## 한 줄 정의

**DNS** 는 도메인을 IP 로 바꿔 주는 시스템이고, 인증이 약해 **정보 유출(Zone Transfer) · 응답 위조(캐시 포이즈닝) · 증폭 DDoS** 의 통로가 된다. 시험은 *설정 파일 읽기 → 공격 원리 → DNSSEC 대응* 순으로 묻는다. {{5-16}} {{6-3}} {{7-3}} {{17-2}} {{26-3}} {{29-7}}

## 기본 구조

- 포트 **53** — 질의·응답은 **UDP**, **Zone Transfer · 512바이트 초과 · DNSSEC 은 TCP**
- **재귀(Recursive/캐시) 서버**: 클라이언트 대신 최종 답을 찾음 (ISP·사내)
- **책임(Authoritative) 서버**: 해당 도메인의 실제 레코드 보유 (Master/Slave)
- 캐시로 상위 부하를 줄이고, 각 레코드는 **TTL** 동안만 유효

### 설정 파일

| 파일 | 역할 |
|---|---|
| **named.conf** | 서버 설정 — 담당 zone(master/slave) · zone 파일 경로 · `allow-transfer` |
| **zone 파일** | 실제 레코드 (SOA NS A AAAA CNAME MX PTR SRV) |
| **resolv.conf** | 클라이언트(리졸버) 설정 — `nameserver` `search` |

```text
# named.conf (Master)
zone "korea.co.kr" IN {
    type master;
    file "korea.co.kr.db";
    allow-transfer { 192.168.1.2; };   # Slave IP 만 허용
};
# named.conf (Slave)
zone "korea.co.kr" IN {
    type slave;
    file "slave/korea.co.kr.db";
    masters { 192.168.1.1; };
};
```

SOA 의 **serial 을 올려야** Slave 가 갱신을 감지한다.

### 레코드 타입

| 타입 | 설명 |
|---|---|
| A / AAAA | 도메인 → IPv4 / IPv6 |
| MX | 메일 서버 |
| NS | Name Server |
| PTR | IP → 도메인 (역방향) |
| CNAME | 도메인 별칭 |
| SOA | Zone 권한 정보 (serial 등) |
| TXT | 텍스트 (SPF·DKIM 등) |
| AXFR | Zone Transfer 전체 전송 (질의 타입) |
| **ANY** | 모든 레코드 조회 — **DRDoS 증폭에 악용** |

## 위협 ① — Zone Transfer (AXFR)

정상: Slave 가 Master 에서 존 전체를 복제한다.
임의 허용 시: **내부 호스트명·IP·구조가 통째로 노출**(정찰)되고, 반복 요청으로 DoS 도 가능하다.

> [!시험] 대응
> `allow-transfer` 로 **Slave IP 만** 허용 · 불필요하면 비활성 · **TSIG** 로 인증

## 위협 ② — 도메인 변조 3종

| 공격 | 변조 지점 | 피해 범위 | 판별 |
|---|---|---|---|
| **hosts 파일 변조** (로컬 파밍) | 피해자 PC 의 hosts | 그 PC 만 | 악성코드 감염, 낯선 항목 |
| **DNS 스푸핑** (LAN) | 같은 네트워크에서 위조 응답을 먼저 전송 (ARP 스푸핑 병행) | LAN 사용자 | 중복·비정상 DNS 응답 |
| **캐시 포이즈닝** (원격) | **재귀 서버 캐시**에 위조 레코드 주입 | 그 리졸버를 쓰는 **모든 사용자** | 정상 도메인이 낯선 IP 로, TTL 동안 지속 |

세 가지 모두 결과는 같다 — 정상 도메인 입력 시 **가짜 사이트로 유도(파밍)**. 차이는 *변조 위치와 피해 범위*.

### 캐시 포이즈닝 상세 {{17-2}}

재귀 서버가 상위에 질의한 사이에, 공격자가 **정답보다 먼저** 위조 응답을 보내 캐시에 심는다. 성공 조건은 **트랜잭션 ID(16비트) · 소스포트 · 질의명 일치**다.

- 고전 기법 **Kaminsky** (2008): TXID·소스포트를 예측, 서브도메인을 무작위 질의해 시도 횟수를 늘림
- **DNSSEC**: 존 데이터에 **전자서명(RRSIG)** 을 붙여 위조를 검출
  - 상위 존이 하위 키의 해시(**DS 레코드**)를 보증하는 **신뢰 체인**(root → TLD → 도메인)

> [!함정] DNSSEC 은 암호화가 아니다
> **무결성·인증**만 제공하고 **기밀성은 제공하지 않는다.**

- 그 밖의 대응: 소스포트·TXID 랜덤화 · 0x20 인코딩(대소문자 랜덤) · 신뢰 리졸버 사용

## 위협 ③ — DNS 증폭 DDoS

출발지 IP 를 **피해자로 위조**한 **ANY/TXT** 질의를 개방형 리졸버에 보내면, 증폭된 응답이 피해자에게 쏟아진다.

- 대응: 개방형 리졸버 차단 · **RRL** · BCP38
- 재귀 질의 남용 차단: `named.conf` 에 `recursion no;` 또는 `allow-recursion { 내부대역; };`
  - 캐시 포이즈닝·DRDoS 악용을 **동시에** 예방

## 분석 — Wireshark DNS 필터 {{7-6}}

| 목적 | 필터 |
|---|---|
| DNS 응답만 | `dns.flags.response == 1` |
| DNS 질의만 | `dns.flags.response == 0` |
| 특정 도메인 | `dns.qry.name == "www.example.com"` |
| 오류 응답 (NXDOMAIN 등) | `dns.flags.rcode != 0` |
| ANY 질의 (증폭 정찰) | `dns.qry.type == 255` |

## 기출 포인트

> [!암기] 서술형 3줄 답안
> - **Zone Transfer**: `allow-transfer` 미설정 시 누구나 AXFR 로 존 전체를 받아 정찰한다. **Slave IP 만 허용 + TSIG 인증**.
> - **캐시 포이즈닝**: 재귀 서버 캐시에 위조 레코드를 심어 가짜 사이트로 유도(파밍). **DNSSEC · TXID·소스포트 랜덤화**.
> - **DNS 증폭 DDoS**: 위조 출발지 + ANY/TXT 로 증폭 응답을 피해자에게. **개방형 리졸버 차단 · RRL · BCP38**.

> [!시험] 이렇게 나온다
> named.conf 의 master/slave 설정 해석 · allow-transfer 의 의미 · hosts 변조·스푸핑·포이즈닝 구분 · DNSSEC 이 제공하는 것/아닌 것 · Wireshark 필터
