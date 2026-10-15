---
title: SNMP · 네트워크 관리 (NMS)
domain: 네트워크보안
questions: [1-2, 6-2, 11-7, 21-2, 24-16, 27-10]
tags: [SNMP, NMS, polling, trap, 커뮤니티스트링, SNMPv3, syslog]
related: [네트워크보안/프로토콜-계층별-보안-총정리, 정보보안관리및법규/보안관제-siem-soar-tms]
---

## 한 줄 정의

**SNMP** 는 Manager(NMS)가 Agent(장비)를 관리하는 프로토콜이다. 시험은 **포트 · 수집 방식(Polling/Trap) · 버전별 보안(v3) · 보안 설정 4가지** 를 묻는다. {{27-10}} {{11-7}} {{1-2}} {{6-2}} {{24-16}}

## 구조와 포트

| 항목 | 값 |
|---|---|
| Manager → Agent 질의·설정 (GET / GETNEXT / SET) | **UDP 161** |
| Agent → Manager 비동기 통보 (**Trap**, InformRequest) | **UDP 162** |
| 데이터 구조 | MIB (계층적 OID 트리) |

PDU: GetRequest · GetNextRequest · GetBulkRequest(v2) · SetRequest · Response · **Trap** · InformRequest

## 수집 방식 {{1-2}}

| 방식 | 설명 |
|---|---|
| **Polling** | NMS 가 주기적으로 Agent 에 **질의**해 수집 |
| **Event Reporting (Trap)** | Agent 가 이벤트 발생 시 NMS 로 **능동 통보** |
| **syslog** | 장비가 로그를 서버로 전송 (**UDP 514**). Trap 과 비슷하지만 텍스트 로그용 |

## 버전별 보안 {{6-2}}

| 버전 | 인증 | 암호화 | 비고 |
|---|---|---|---|
| v1 / v2c | 커뮤니티 스트링 (평문) | 없음 | 스니핑·위조에 취약 |
| **v3** | USM (사용자 + HMAC-MD5/SHA) | DES / AES | 3대 보안 기능 제공 |

### SNMPv3 보안 매개변수 → 막는 공격

| 매개변수 | 방지 |
|---|---|
| msgAuthoritativeEngineID / Boots / Time | **재전송(Replay)** |
| msgUserName + msgAuthenticationParameters (HMAC) | **메시지 위·변조** |
| msgPrivacyParameters (암호화) | **도청·스니핑** |

보안 수준: `noAuthNoPriv` < `authNoPriv` < `authPriv`

## 보안 설정 4가지 {{24-16}}

> [!암기] 변경 · v3 · ACL · RW 제거
> 1. 커뮤니티 스트링을 `public` / `private` 기본값이 아닌 **추측 어려운 값**으로 변경
> 2. 암호화가 되는 **SNMPv3** 사용
> 3. **ACL** 로 SNMP 접근 가능한 관리 호스트 IP 제한
> 4. **RW 커뮤니티 제거**, 가급적 RO 만 사용 (필요 없으면 SNMP 자체를 비활성)

### 비활성화 {{21-2}}

```text
Router# configure terminal
Router(config)# no snmp-server
```

## 기출 포인트

> [!시험] 이렇게 나온다
> SNMP 포트(161/162) · Polling vs Trap · v3 가 막는 공격과 보안 매개변수 · 보안 설정 4가지 · `no snmp-server`
