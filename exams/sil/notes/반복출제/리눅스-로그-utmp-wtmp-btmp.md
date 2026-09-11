---
title: 리눅스 로그인 로그 — utmp / wtmp / btmp / lastlog
domain: 시스템보안
questions: [6-5, 14-6, 22-2, 27-5]
tags: [utmp, wtmp, btmp, lastlog, 로그파일]
---

**6·14·22·27회 반복 출제.** 빈칸에 로그 파일명.

**핵심 정답 (모두 바이너리)**
- **utmp** (`/var/run/utmp`): **현재 로그인 중**인 사용자 상태. `who`, `w`.
- **wtmp** (`/var/log/wtmp`): 로그인·로그아웃·**재부팅** 이력 누적. `last`.
- **btmp** (`/var/log/btmp`): **로그인 실패** 기록. `lastb`. 무차별 대입 탐지.
- **lastlog** (`/var/log/lastlog`): 사용자별 **마지막 성공 로그인** 시각·접속지. `lastlog`.

**함정**: '현재' = utmp, '실패' = btmp, '마지막 성공' = lastlog. 텍스트 인증로그는 `/var/log/secure`(RHEL)·`auth.log`(Debian).
