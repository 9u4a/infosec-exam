---
title: PAM 모듈 타입 — auth / account / password / session
domain: 시스템보안
questions: [23-7, 29-1]
tags: [PAM, auth, account, session, controlflag]
---

**23·29회 반복 출제.** (A)(B)(C) 빈칸.

**핵심 정답**
- **auth**: 실질적 **인증**(패스워드 등 자격증명 검증).
- **account**: 계정 유효성·**시스템 사용 권한** 확인(만료, 시간대, 접속 IP 등).
- **password**: 비밀번호 설정·변경·정책(복잡도·이력).
- **session**: 인증 성공 시·종료 시 **세션 설정**(홈 마운트, 로그, ulimit).

**함정**: '실질적 인증' = auth, '사용 권한 확인' = account, '세션을 맺어줌' = session. Control flag: required/requisite/sufficient/optional/include.
