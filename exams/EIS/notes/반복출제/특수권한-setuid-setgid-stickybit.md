---
title: 특수 권한 비트 — SetUID / SetGID / Sticky Bit
domain: 시스템보안
questions: [1-11, 19-11]
tags: [SetUID, SetGID, StickyBit, 특수권한, 권한상승]
---

**1·19회 반복 출제.** `passwd`/`mail`/`/tmp` 권한 표기 해석.

**핵심 정답**
- `-r-sr-xr-x root ... /usr/bin/passwd` — 소유자 실행 자리 **`s` = SetUID** → 일반 사용자가 실행해도 **소유자(root) 권한**으로 동작.
- `-r-xr-sr-x root mail /usr/bin/mail` — 그룹 실행 자리 **`s` = SetGID** → 소유 그룹(mail) 권한으로 동작.
- `drwxrwxrwt ... /tmp` — 기타 실행 자리 **`t` = Sticky Bit** → 누구나 파일 생성 가능하나 **삭제는 소유자·root만**.

**함정**: 8진수 SetUID 4000 / SetGID 2000 / Sticky 1000. SetUID 파일은 권한상승 취약점의 근원 → `find / -perm -4000`.
