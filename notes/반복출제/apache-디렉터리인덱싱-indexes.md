---
title: Apache 디렉터리 인덱싱 대응 — Options 에서 Indexes 제거
domain: 애플리케이션보안
questions: [20-8, 29-11]
tags: [디렉터리인덱싱, Options, Indexes, FollowSymLinks, Apache]
---

**20·29회 반복 출제.** `<Directory>` 설정에서 '디렉터리 인덱싱 취약점 대응을 위해 삭제할 지시자는?'

**핵심 정답**: **`Indexes`** (`Options -Indexes`)
- `Options Indexes`는 index 파일(index.html 등)이 없을 때 **디렉터리 내용을 자동 목록 표시** → 소스·백업·설정 파일 유출.
- 함께 위험: **`FollowSymLinks`**(심볼릭 링크로 웹루트 밖 접근) → `SymLinksIfOwnerMatch`로 완화.

**함정**: 답은 소문자 `indexes` 그대로도 인정. `AllowOverride`, `Require`는 관련 없음. → [🔗 Apache LimitRequestBody — 업로드 최대 크기 제한](#/note/%EB%B0%98%EB%B3%B5%EC%B6%9C%EC%A0%9C%2Fapache-limitrequestbody)
