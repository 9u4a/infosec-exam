---
title: SNMP · 네트워크 관리 (NMS)
domain: 네트워크보안
questions: [1-2, 6-2, 11-7, 21-2, 24-16, 27-10]
tags: [SNMP, NMS, polling, trap, 커뮤니티스트링, SNMPv3, syslog]
---

## SNMP 개요 (27-10, 11-7)

Manager(NMS) ↔ Agent 구조의 TCP/IP 네트워크 장비 관리 프로토콜.

| 항목 | 값 |
|---|---|
| Manager → Agent 질의/설정 (GET/GETNEXT/SET) | **UDP 161** |
| Agent → Manager 비동기 통보 (**Trap**, InformRequest) | **UDP 162** |
| 데이터 구조 | MIB (계층적 OID 트리) |

- **PDU**: GetRequest, GetNextRequest, GetBulkRequest(v2), SetRequest, Response, **Trap**, InformRequest.

## 수집 방식 (1-2)

| 방식 | 설명 |
|---|---|
| **Polling** | NMS(Manager)가 주기적으로 Agent에 상태·통계를 **질의**해 수집 |
| **Event Reporting (Trap)** | Agent가 특정 이벤트 발생 시 NMS로 **능동 통보** |
| **syslog** | 장비가 로그 메시지를 로그 서버로 전송 (UDP 514). Trap과 유사하나 텍스트 로그용 |

## 버전별 보안 (6-2)

| 버전 | 인증 | 암호화 | 비고 |
|---|---|---|---|
| v1 / v2c | 커뮤니티 스트링(평문) | 없음 | 스니핑·위조에 취약 |
| **v3** | USM (사용자 + HMAC-MD5/SHA) | DES/AES | 3대 보안 기능 제공 |

### SNMPv3 보안 매개변수 → 방지 공격 (6-2)

| 매개변수 | 방지 |
|---|---|
| msgAuthoritativeEngineID / Boots / Time | **재전송(Replay) 공격** |
| msgUserName + msgAuthenticationParameters (HMAC) | **메시지 위·변조** |
| msgPrivacyParameters (암호화) | **도청/스니핑** |

- 보안 수준: `noAuthNoPriv` < `authNoPriv` < `authPriv`.

## SNMP 보안 설정 4가지 (24-16)

① 커뮤니티 스트링을 `public`/`private` 기본값이 아닌 추측 어려운 값으로 변경
② 암호화 지원되는 **SNMPv3** 사용
③ **ACL** 로 SNMP 접근 가능한 관리 호스트 IP 제한
④ **RW(Read-Write) 커뮤니티 제거**, 가급적 RO(Read-Only)만 사용 (+ 불필요 시 SNMP 자체 비활성)

## SNMP 비활성화 (21-2)

```
Router# configure terminal
Router(config)# no snmp-server
```
