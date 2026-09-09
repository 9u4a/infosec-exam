---
title: C 코드 버퍼 오버플로우 — strcpy
domain: 시스템보안
questions: [4-10, 29-5]
tags: [버퍼오버플로우, strcpy, strncpy, 위험함수, 스택]
---

**4·29회 반복 출제.** `char buf[N]; strcpy(buf, argv[1]);` 코드 → 취약점·취약함수·수정.

**핵심 정답**
- **취약점**: 스택 **버퍼 오버플로우**. 입력 길이를 검증하지 않아 N바이트를 넘으면 스택의 SFP·**복귀주소(RET)**를 덮어써 임의 코드 실행.
- **취약 함수**: `strcpy` (그 외 `strcat`, `sprintf`, `gets`, `scanf("%s")`).
- **수정**: `strncpy(buf, argv[1], sizeof(buf)-1); buf[sizeof(buf)-1]='\0';` 또는 `snprintf`, `strlcpy`.

**함정**: 방어기법(카나리·DEP/NX·ASLR)은 컴파일·OS 레벨, 코드 수정은 **길이 제한 함수** 사용.
