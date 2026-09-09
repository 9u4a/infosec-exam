---
title: SQL Injection — 인증 우회 (' OR '1'='1)
domain: 애플리케이션보안
questions: [6-14, 30-18]
tags: [SQLInjection, 인증우회, OR1=1, PreparedStatement]
---

**6·30회 반복 출제.** 로그인 쿼리 → 취약점명 / 인증 우회 구문 / 가능한 이유.

**핵심 정답**
- 취약점: **SQL Injection**.
- 우회 구문: 패스워드(또는 username) 자리에 **`' OR '1'='1`** → `WHERE id='user1' AND pw='' OR '1'='1'` → 조건이 **항상 참** → 전체 레코드 조회 / 인증 우회.
- 가능한 이유: 입력값을 **문자열로 이어붙여** 쿼리를 만들기 때문(쿼리 구조가 바뀜).
- 근본 대응: **PreparedStatement(파라미터 바인딩)** — 입력이 데이터로만 취급됨. + 최소권한 계정, 오류메시지 최소화, 입력검증.

**함정**: 대응은 '입력 필터링'이 아니라 **파라미터 바인딩**이 근본. → [🔗 SW 개발보안 3대 인젝션 — SQLi · XSS · OS 명령어 삽입](#/note/%EB%B0%98%EB%B3%B5%EC%B6%9C%EC%A0%9C%2Fsw%EA%B0%9C%EB%B0%9C%EB%B3%B4%EC%95%88-3%EB%8C%80-%EC%9D%B8%EC%A0%9D%EC%85%98)
