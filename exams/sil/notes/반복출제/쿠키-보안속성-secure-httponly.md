---
title: 쿠키 보안 속성 — Secure / HttpOnly / (Expires · SameSite)
domain: 애플리케이션보안
questions: [16-11, 22-15]
tags: [쿠키보안, Secure, HttpOnly, SameSite, XSS, 스니핑]
---

**16·22회 반복 출제.** 각 속성의 기능과 대응 공격.

**핵심 정답**
- **Secure**: **HTTPS 연결에서만** 쿠키 전송 → 평문 **스니핑**으로 인한 세션쿠키 탈취 방지.
- **HttpOnly**: 자바스크립트(`document.cookie`) 접근 차단 → **XSS**를 통한 쿠키 탈취 방지.
- **Expires/Max-Age**: 만료 시각 지정 → 탈취된 쿠키의 재사용 창 최소화.
- **SameSite**: 크로스 사이트 요청에 쿠키 미전송 → **CSRF** 완화.

**함정**: Secure = 스니핑, HttpOnly = XSS. 세트: `Set-Cookie: sid=...; Secure; HttpOnly; SameSite=Lax`.
