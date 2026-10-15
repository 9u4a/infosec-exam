---
title: /etc/passwd · /etc/shadow 구조
domain: 시스템보안
questions: [13-5, 14-12, 16-1, 22-3, 26-1, 29-6, 30-1, 31-1]
tags: [passwd, shadow, 해시, salt, 계정정책]
---

## 한 줄 정의

유닉스 계정 정보는 **공개 파일 `/etc/passwd`(7필드)** 와 **비밀 파일 `/etc/shadow`(9필드)** 로 나뉜다. 해시를 shadow 로 옮겨 일반 사용자가 못 읽게 한 것이 핵심이며, 시험은 **필드 의미 · 해시 식별자 · 점검 명령**을 묻는다. {{13-5}} {{14-12}} {{22-3}}

## /etc/passwd — 7필드 (구분 `:`, 권한 644)

```text
root : x : 0 : 0 : root : /root : /bin/bash
 (1)  (2) (3) (4)  (5)     (6)       (7)
```

| # | 필드 | 의미 |
|---|---|---|
| 1 | 사용자명 | |
| 2 | 패스워드 | **`x`** = 해시는 shadow 에 있음 · **비어 있음 = 무패스워드 로그인** |
| 3 | **UID** | 0 = root · 1~999 시스템 · 1000+ 일반 |
| 4 | **GID** | 기본 그룹 |
| 5 | GECOS | 이름·전화 등 설명 |
| 6 | 홈 디렉터리 | |
| 7 | **로그인 셸** | `/bin/false` · `/sbin/nologin` → 로그인 차단 (서비스 계정) |

> [!함정] UID 0 계정이 둘 이상이면 백도어
> root 가 아닌 이름인데 UID 가 0 이면 사실상 root 계정이다.

## /etc/shadow — 9필드 (권한 400 또는 000, 소유 root)

암호 필드 형식은 **`$id$salt$hash`** 다.

| $id | 알고리즘 | 비고 |
|---|---|---|
| `$1$` | MD5 | 취약 |
| `$2a$` `$2y$` | bcrypt | |
| `$5$` | SHA-256 | |
| `$6$` | SHA-512 | 다수 배포판 기본 |
| `$y$` | yescrypt | 최신 |
| `$` 없이 13자 | DES crypt | 구형 |

- 암호 필드가 `*` · `!` · `!!` → **로그인 잠금** (패스워드 없음과 다르다)
- 나머지 필드: 최종변경일 · 최소사용일 · **최대사용일** · 경고일 · 비활성일 · 만료일

### salt 가 레인보우 테이블을 막는 이유

같은 비밀번호도 salt 가 다르면 해시가 달라진다. 미리 계산한 해시 표를 쓸 수 없고, **계정마다 따로 무차별 대입**해야 한다. 반복 횟수(rounds)는 계산 비용을 더 키운다.

## 계정 정책

| 대상 | 방법 |
|---|---|
| 신규 계정 | `/etc/login.defs` — `PASS_MAX_DAYS` · `PASS_MIN_DAYS` · `PASS_MIN_LEN` · `PASS_WARN_AGE` |
| 기존 계정 | `chage -M 90 -m 1 -W 7 사용자` |
| 복잡도 | PAM `pam_pwquality` (`/etc/security/pwquality.conf`) |

계열별 최소 길이 파일:

| OS | 파일 · 설정 |
|---|---|
| Solaris | `/etc/default/passwd` (PASSLENGTH) |
| AIX | `/etc/security/user` (minlen) |
| HP-UX | `/etc/default/security` |

## 점검 명령

```bash
awk -F: '$3==0 {print $1}' /etc/passwd        # UID 0 계정
awk -F: '($2==""){print $1}' /etc/shadow      # 빈 패스워드
pwck ; grpck                                   # 파일 무결성 검사
```

## 기출 포인트

> [!시험] 이렇게 나온다
> passwd 필드 번호별 의미 · shadow `$6$` 등 식별자로 알고리즘 맞히기 · `!`·`*` 의 뜻 · UID 0 / 빈 패스워드 찾는 명령 · 패스워드 최대 사용기간 설정
