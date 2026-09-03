---
title: iptables 방화벽 정책
domain: 네트워크보안
questions: [10-13, 21-14, 24-15, 31-3]
tags: [iptables, DROP, REJECT, chain, state, recent, SYN]
---

## 구조

`iptables -t <테이블> -A <체인> <매치> -j <타깃>`

| 테이블 | 용도 |
|---|---|
| **filter** (기본) | 패킷 허용/차단 |
| **nat** | 주소 변환 (SNAT/DNAT/MASQUERADE) |
| **mangle** | 헤더 필드 수정 (TOS, TTL, MARK) |

## 체인 (24-15)

| 체인 | 대상 패킷 |
|---|---|
| **INPUT** | 방화벽 자신이 **최종 목적지** |
| **FORWARD** | 방화벽을 **경유**(통과)하는 패킷 |
| **OUTPUT** | 방화벽 자신이 **출발지** |
| PREROUTING / POSTROUTING | 라우팅 전/후 (주로 nat) |

## 타깃 — DROP vs REJECT (10-13)

| | DROP | REJECT |
|---|---|---|
| 동작 | 조용히 폐기, **무응답** | 폐기 + 출발지에 RST(TCP) 또는 ICMP unreachable 응답 |
| 스캐너 관점 | 포트가 filtered 인지 판별 어려움 (타임아웃) | 닫힘을 즉시 알림 → 스캔이 빠름 |
| 권장 | **DROP** (정보 노출 최소화, 스캔 지연) | 내부망 사용성 위해 제한적으로 |

## 상태 추적 (stateful)

```
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p tcp ! --syn -m state --state NEW -j LOG --log-prefix "[FW] "
```
- 두 번째 룰: SYN이 아닌데 상태가 NEW인 TCP = 비정상(스푸핑/스캔/세션 하이재킹 시도) → 로깅.
- 상태: NEW(첫 패킷) / ESTABLISHED(양방향 성립) / RELATED(FTP 데이터 등 연관) / INVALID.

## ICMP Echo 차단 (31-3)

```
iptables -A INPUT -p icmp --icmp-type echo-request -j DROP
```
- `--icmp-type echo-request`(= type 8) 차단 → 외부 ping 응답 안 함. `echo-reply`(type 0)는 내가 보낸 ping의 응답.

## SYN Rate Limit (21-14)

동일 출발지에서 2초 동안 80포트로 SYN 30개 이상 → 차단:

```
iptables -A INPUT -p tcp --syn --dport 80 \
  -m recent --update --seconds 2 --hitcount 30 --name SYN_DROP -j DROP
iptables -A INPUT -p tcp --syn --dport 80 -m recent --set --name SYN_DROP
```

| 옵션 | 의미 |
|---|---|
| `-A INPUT` | INPUT 체인에 규칙 추가 (인바운드) |
| `-p tcp --syn` | TCP SYN 패킷만 (연결 시도) |
| `--dport 80` | 목적지 포트 80 |
| `-m recent --update --seconds 2 --hitcount 30` | 최근 목록에서 2초 내 30회 이상이면 매치 |
| `-j DROP` | 폐기 |

- `-m limit --limit 25/minute --limit-burst 100` 방식도 자주 출제 (토큰 버킷).
