---
title: HTTP OPTIONS 메서드로 서버 지원 메서드 점검 (telnet)
domain: 애플리케이션보안
questions: [20-1, 27-8]
tags: [HTTPOPTIONS, Allow헤더, TRACE, XST, 배너그래빙]
---

**20·27회 반복 출제.** `telnet host 80` 후 빈칸 명령어 → 응답 `Allow:` 헤더.

**핵심 정답**: **`OPTIONS`** (`OPTIONS * HTTP/1.0`)
- 응답 `Allow:` 헤더로 서버가 지원하는 HTTP 메서드 확인(예: GET/HEAD/POST/OPTIONS/**TRACE**).
- 위험: PUT·DELETE(파일 조작), **TRACE(XST — 쿠키 탈취)** → 불필요 메서드 비활성화.
- `Server: Microsoft-IIS/5.0` 배너로 버전도 노출(배너 그래빙).

**함정**: `Allow` 헤더는 OPTIONS 응답. TRACE 차단 = `TraceEnable off`.
