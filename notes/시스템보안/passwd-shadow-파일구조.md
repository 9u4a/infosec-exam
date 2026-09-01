---
title: /etc/passwd · /etc/shadow 구조
domain: 시스템보안
questions: [13-5, 14-12, 16-1, 22-3, 26-1, 29-6, 30-1, 31-1]
tags: [passwd, shadow, 해시, salt, 계정정책]
---

## /etc/passwd (7필드, `:` 구분, 권한 644)

```
root : x : 0 : 0 : root : /root : /bin/bash
 (1)  (2) (3) (4)  (5)     (6)       (7)
```

| # | 필드 | 설명 |
|---|---|---|
| 1 | 사용자명 | |
| 2 | 패스워드 | **`x`** = 해시가 `/etc/shadow`에 있음 / 비어있음 = 무패스워드 로그인 |
| 3 | **UID** | 0 = root, 1~999 시스템, 1000+ 일반 (UID 0 계정이 여럿이면 백도어) |
| 4 | **GID** | 기본 그룹 |
| 5 | GECOS | 설명(이름·전화 등) |
| 6 | 홈 디렉토리 | |
| 7 | **로그인 셸** | `/bin/false`·`/sbin/nologin` → 로그인 차단(서비스 계정) |

## /etc/shadow (9필드, 권한 400 또는 000, 소유 root)

암호 필드 = **`$id$salt$hash`**

| $id | 알고리즘 |
|---|---|
| `$1$` | MD5 (취약) |
| `$2a$`,`$2y$` | bcrypt |
| `$5$` | SHA-256 |
| `$6$` | SHA-512 (다수 배포판 기본) |
| `$y$` | yescrypt (최신) |
| `$` 없이 13자 | 구형 DES crypt |

- 암호 필드가 `*` 또는 `!` / `!!` → 로그인 잠금 (패스워드 없음과 다름)
- 나머지 필드: 최종변경일 · 최소사용일 · **최대사용일** · 경고일 · 비활성일 · 만료일

## salt가 레인보우 테이블을 무력화하는 이유

같은 비밀번호라도 salt가 달라 해시값이 달라진다 → 사전 계산된 해시 테이블을 못 쓰고 **계정마다 개별 무차별 대입**이 필요해진다. + 반복 횟수(rounds)로 계산 비용을 높인다.

## 계정 정책 파일

- `/etc/login.defs` — `PASS_MAX_DAYS` · `PASS_MIN_DAYS` · `PASS_MIN_LEN` · `PASS_WARN_AGE` (신규 계정)
- 기존 계정 변경: `chage -M 90 -m 1 -W 7 사용자`
- 복잡도: PAM `pam_pwquality` (`/etc/security/pwquality.conf`)
- 계열별 최소길이: Solaris `/etc/default/passwd`(PASSLENGTH) · AIX `/etc/security/user`(minlen) · HP-UX `/etc/default/security`

## 점검

```bash
awk -F: '$3==0 {print $1}' /etc/passwd        # UID 0 계정
awk -F: '($2==""){print $1}' /etc/shadow      # 빈 패스워드
pwck ; grpck                                   # 무결성 검사
```
