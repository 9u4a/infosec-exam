---
title: iptables 방화벽 정책
domain: 네트워크보안
questions: [10-13, 21-14, 24-15, 31-3]
tags: [iptables, DROP, REJECT, chain, state, recent, SYN]
---

## 한 줄 정의

**iptables** 는 리눅스 커널 방화벽(netfilter)의 규칙 도구다. 기본 골격은 `iptables -t <테이블> -A <체인> <매치> -j <타깃>` 이며, 시험은 **어느 체인에 · 어떤 매치로 · 어떤 타깃을** 쓰는지 읽고 쓰게 한다. {{10-13}} {{21-14}} {{24-15}} {{31-3}}

## 구조 — 테이블 · 체인

| 테이블 | 용도 |
|---|---|
| **filter** (기본) | 패킷 허용 / 차단 |
| **nat** | 주소 변환 (SNAT · DNAT · MASQUERADE) |
| **mangle** | 헤더 수정 (TOS · TTL · MARK) |

### 체인 {{24-15}}

| 체인 | 대상 패킷 |
|---|---|
| **INPUT** | 방화벽 자신이 **최종 목적지** |
| **FORWARD** | 방화벽을 **경유**(통과) |
| **OUTPUT** | 방화벽 자신이 **출발지** |
| PREROUTING / POSTROUTING | 라우팅 전 / 후 (주로 nat) |

> [!함정] INPUT vs FORWARD
> 방화벽 *뒤의 서버*로 가는 트래픽은 INPUT 이 아니라 **FORWARD** 다.

## 주요 옵션

| 옵션 | 의미 |
|---|---|
| `-A` | Append — 규칙을 맨 끝에 추가 |
| `-I n` | Insert — n번째 위치에 삽입 |
| `-D n` | Delete — n번째 규칙 삭제 |
| `-L -n` | 규칙 목록 (숫자로) |
| `-F` | Flush — 모든 규칙 삭제 |
| `-P` | Policy — 체인 기본 정책 |
| `-s` / `-d` | 출발지 / 목적지 IP |
| `--sport` / `--dport` | 출발지 / 목적지 포트 |
| `-p` | 프로토콜 (tcp · udp · icmp) |
| `-j` | 타깃 지정 |

`LOG` 타깃은 패킷을 버리지 않고 `/var/log/messages` 에 기록한 뒤 **다음 규칙을 계속 평가**한다. 차단하려면 별도 DROP/REJECT 규칙이 필요하다.

## 타깃 — DROP vs REJECT {{10-13}}

| | DROP | REJECT |
|---|---|---|
| 동작 | 조용히 폐기, **무응답** | 폐기 + 출발지에 RST(TCP) 또는 ICMP unreachable |
| 스캐너 관점 | filtered 인지 판별이 어려움 (타임아웃) | 닫혔음을 즉시 알려 스캔이 빨라짐 |
| 권장 | **DROP** — 정보 노출 최소화, 스캔 지연 | 내부망 사용성이 필요할 때 제한적으로 |

## 규칙 예제

### 상태 추적 (stateful)

```text
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p tcp ! --syn -m state --state NEW -j LOG --log-prefix "[FW] "
```

- 두 번째 규칙: **SYN 이 아닌데 상태가 NEW** 인 TCP = 비정상(스푸핑·스캔·세션 하이재킹 시도) → 로깅
- 상태 값: NEW(첫 패킷) · ESTABLISHED(양방향 성립) · RELATED(FTP 데이터 등 연관) · INVALID

### ICMP Echo 차단 {{31-3}}

```text
iptables -A INPUT -p icmp --icmp-type echo-request -j DROP
```

`echo-request`(type 8)를 막으면 외부 ping 에 응답하지 않는다. `echo-reply`(type 0)는 내가 보낸 ping 의 응답이다.

### SYN Rate Limit {{21-14}}

동일 출발지가 **2초 동안 80포트로 SYN 30개 이상** → 차단

```text
iptables -A INPUT -p tcp --syn --dport 80 \
  -m recent --update --seconds 2 --hitcount 30 --name SYN_DROP -j DROP
iptables -A INPUT -p tcp --syn --dport 80 -m recent --set --name SYN_DROP
```

| 옵션 | 의미 |
|---|---|
| `-A INPUT` | INPUT 체인에 추가 (인바운드) |
| `-p tcp --syn` | TCP SYN(연결 시도)만 |
| `--dport 80` | 목적지 포트 80 |
| `-m recent --update --seconds 2 --hitcount 30` | 최근 목록에서 2초 내 30회 이상이면 매치 |
| `-j DROP` | 폐기 |

> [!팁] 같은 목적의 다른 방식
> `-m limit --limit 25/minute --limit-burst 100` (토큰 버킷)도 자주 출제된다.

## 기출 포인트

> [!시험] 이렇게 나온다
> 체인별 대상 패킷 구분 · DROP 과 REJECT 차이 · `recent` 모듈 옵션 해석(2초 30회) · `! --syn` + NEW 의 의미 · ICMP echo-request 차단
