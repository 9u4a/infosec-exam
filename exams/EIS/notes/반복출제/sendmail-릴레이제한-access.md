---
title: sendmail 스팸 릴레이 제한 — access / makemap
domain: 애플리케이션보안
questions: [20-14, 21-1]
tags: [sendmail, 릴레이제한, access.db, makemap, REJECT]
---

**20·21회 반복 출제.** access DB 생성 명령 빈칸.

**핵심 정답**
- sendmail은 `/etc/mail/access`(텍스트 정책)를 직접 읽지 않고 **해시 DB**를 참조.
- 명령: **`makemap hash /etc/mail/access.db < /etc/mail/access`** (`makemap` = map 생성 도구, `hash` = DB 타입).
- `access` 정책: `RELAY`(허용), **`REJECT`**(거부·오류 회신), `DISCARD`(조용히 폐기).
- `sendmail.cf`의 `R$* $#error ... "550 Relaying denied"` 규칙이 미허용 중계를 거부.

**함정**: 정책 편집 후 **반드시 makemap으로 DB 재생성**해야 반영.
