---
title: 익스플로잇 구성 — 셸코드 · NOP(0x90) · jmp esp
domain: 시스템보안
questions: [7-2, 21-9]
tags: [셸코드, NOP, NOPsled, jmpesp, 버퍼오버플로우]
---

**7·21회 반복 출제.** (A)(B)(C) 빈칸.

**핵심 정답**
- **(A) 셸코드(Shellcode)**: 기계어로 된 익스플로잇의 **본체**(셸 실행 등 목적 동작).
- **(B) NOP hex = `0x90`** (x86). NOP sled로 정확한 리턴 주소 예측 부담을 줄임.
- **(C) `jmp esp`** (또는 `call esp`): **ESP가 가리키는(주입한 셸코드) 위치로 실행 흐름을 넘기는** 어셈블리 명령 → 스택 오버플로우 익스플로잇의 핵심 가젯.

**함정**: ESP → EIP 이동 = `jmp esp`. 방어: 스택 카나리, DEP/NX(NOP sled 무력화), ASLR.
