---
title: SW 개발보안 3대 인젝션 — SQLi · XSS · OS 명령어 삽입
domain: 애플리케이션보안
questions: [18-3, 27-7]
tags: [SQLInjection, XSS, 명령어삽입, 인젝션, 입력검증]
---

**18·27회 반복 출제.** (A)(B)(C) 취약점명.

**핵심 정답**
- **(A) SQL Injection**: DB와 연결된 애플리케이션의 **입력값을 조작**해 의도하지 않은 쿼리 결과를 반환.
- **(B) XSS (Cross-Site Scripting)**: 게시판·웹·메일에 삽입된 악성 스크립트가 브라우저에서 실행되어 **쿠키·개인정보 탈취**.
- **(C) 운영체제 명령어 삽입(Command Injection)**: 검증 안 된 입력이 **OS 명령의 일부로 전달**되어 실행.

**공통 대응**: 입력 검증(화이트리스트) + 파라미터화/안전 API + 출력 인코딩 + 최소권한.

**함정**: (B) '쿠키를 특정 사이트로 전송' = XSS(CSRF 아님). → [🔗 SQL Injection — 인증 우회 (' OR '1'='1)](#/note/%EB%B0%98%EB%B3%B5%EC%B6%9C%EC%A0%9C%2Fsql-injection-%EC%9D%B8%EC%A6%9D%EC%9A%B0%ED%9A%8C)
