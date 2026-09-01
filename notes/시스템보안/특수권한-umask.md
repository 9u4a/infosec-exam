---
title: 특수 권한 (SetUID·SetGID·Sticky) · umask
domain: 시스템보안
questions: [1-11, 19-11, 24-13, 27-15, 32-18, 30-17]
tags: [setuid, setgid, sticky, umask, chmod, find]
---

## 특수 비트

| 비트 | 8진수 | 표기 | 의미 |
|---|---|---|---|
| **SetUID** | 4000 | 소유자 실행자리 `s`(`r-s`) | 실행 시 프로세스 EUID가 **파일 소유자**로 (예: `/usr/bin/passwd` → root) |
| **SetGID** | 2000 | 그룹 실행자리 `s` | 실행 시 소유 **그룹 권한**으로 / 디렉토리에 걸면 그 안에 만든 파일이 디렉토리 그룹 상속 |
| **Sticky** | 1000 | 기타 실행자리 `t`(`rwt`) | 디렉토리 내 파일 삭제는 **소유자·root만** (공용 `/tmp`) |

- 실행 권한이 없는데 특수비트 → 대문자 `S`/`T` (기능 안 함)

## 위험 & 점검

취약한 **SetUID root 바이너리** = 즉시 권한 상승 통로. 불필요한 것을 주기적으로 찾아 제거.

```bash
# SUID / SGID 파일 탐색
find / -user root -type f \( -perm -4000 -o -perm -2000 \) -exec ls -al {} \;
find / -perm -4000 2>/dev/null      # SUID (find / -perm -04000)
find / -perm -2000 2>/dev/null      # SGID

# 제거
chmod -s <파일>       # SUID/SGID 제거
chmod u-s / g-s <파일>
```

정상 SUID 예: passwd, su, sudo, ping, mount, crontab, chsh. 그 외 사용자 스크립트·복사본은 의심.

## RUID / EUID / SUID (프로세스)

- **RUID**: 실제 UID (실행한 사람)
- **EUID**: 유효 UID (권한 판단 기준)
- **SUID(saved)**: 되돌아갈 UID 저장

SetUID root 실행 직후: RUID=사용자, EUID=0, SUID=0.
`setuid(600)` 호출(EUID가 0일 때) → **셋 다 600으로 영구 강등** (권한 포기, 복원 불가).
`seteuid()` 는 EUID만 변경 → SUID로 복원 가능.

## umask

생성 시 기본 권한에서 **뺄 비트**. `기본권한 - umask`.

| umask | 파일(666 기준) | 디렉토리(777 기준) |
|---|---|---|
| 022 | 644 | 755 |
| 027 | 640 | 750 (권장, 보안 강화) |
| 077 | 600 | 700 |

설정: `/etc/profile`, `/etc/bashrc`, `~/.bashrc` 에 `umask 022`.
