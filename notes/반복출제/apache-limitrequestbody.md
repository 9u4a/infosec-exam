---
title: Apache LimitRequestBody — 업로드 최대 크기 제한
domain: 애플리케이션보안
questions: [14-8, 21-10]
tags: [LimitRequestBody, Apache, httpd.conf, 업로드제한]
---

**14·21회 반복 출제.** '`httpd.conf`에서 디렉터리에 업로드 가능한 최대 파일 사이즈를 제한하는 명령어는?'

**핵심 정답**: **`LimitRequestBody`** (바이트 단위, 0 = 무제한). `httpd.conf` 또는 `<Directory>` 블록에 지정.
- 효과: 대용량 업로드 기반 DoS, 대형 웹셸 업로드 완화.

**함정**: PHP는 별도로 `upload_max_filesize`·`post_max_size`(php.ini). `LimitRequestFields`(헤더 개수), `LimitRequestLine`(요청 라인 길이)와 혼동 금지.
