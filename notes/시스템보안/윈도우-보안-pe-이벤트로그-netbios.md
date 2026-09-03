---
title: Windows 보안 — PE 구조 · 로그 경로 · NetBIOS
domain: 시스템보안
questions: [7-1, 23-1, 23-15, 28-14, 29-17, 31-5]
tags: [PE, 섹션, IIS로그, HTTPERR, DHCP, NetBIOS, ncpa.cpl, 이벤트로그]
---

## PE (Portable Executable) 구조 — 7-1

Windows NT 계열 실행 파일 포맷 (`.exe`, `.dll`, `.sys`, `.ocx`).

`DOS 헤더 → DOS Stub → NT 헤더(Signature+File Header+Optional Header) → 섹션 헤더 → 섹션들`

| 섹션 | 내용 |
|---|---|
| **.text** | 실행 코드(기계어) — 실행·읽기 |
| **.data** | 초기화된 전역 변수·상수 — 읽기·쓰기 |
| **.rdata** | 읽기 전용 데이터, 문자열 |
| **.bss** | 초기화되지 않은 전역 변수 |
| **.idata** | Import 정보 — 사용하는 **DLL·API 목록**(IAT) |
| **.edata** | Export 정보 (DLL이 제공하는 함수) |
| **.rsrc** | 리소스 (아이콘, 버전, 매니페스트) |
| **.reloc** | 재배치 정보 (ASLR/기준주소 변경 시) |

- 악성코드 분석: `.text` 엔트로피가 높으면 패킹 의심, `.idata` 의 API 조합으로 행위 추정.
- EP(Entry Point)가 마지막 섹션·비정상 위치 → 패커/인젝션 흔적.

## Windows 로그 파일 경로 — 23-1, 31-5

| 로그 | 경로 |
|---|---|
| IIS 액세스 로그 | `C:\inetpub\logs\LogFiles\W3SVC<n>\` (구버전 `C:\Windows\System32\LogFiles\W3SVC<n>`) |
| **HTTP 에러 로그** | `C:\Windows\System32\LogFiles\HTTPERR\` |
| **DHCP 로그** | `C:\Windows\System32\dhcp\` (문제 지문상 `...\LogFiles\DHCP`) |
| 방화벽 로그 | `C:\Windows\System32\LogFiles\Firewall\pfirewall.log` |
| 이벤트 로그(.evtx) | `C:\Windows\System32\winevt\Logs\` |

## 이벤트 로그 크기 산정 — 29-17

**최대 로그 크기 = 단일 이벤트 최대 크기 × 하루 최대 이벤트 수 × 보관 일수**
예) 500 B × 1,000 개 × 30 일 = **15,000,000 B ≈ 15,000 KB ≈ 14.3 MB**
설정: 이벤트 뷰어 → 해당 로그 → 속성 → "최대 로그 크기" + 초과 시 정책(덮어쓰기/보관).

주요 보안 이벤트 ID: 4624(로그온 성공) 4625(실패) 4634(로그오프) 4720(계정 생성) 4728(그룹 추가) 4672(특수권한) 1102(감사로그 삭제).

## NetBIOS 바인딩 취약점 — 23-15, 28-14

**취약한 이유**: 인터넷에 직접 연결된 Windows에서 TCP/IP over NetBIOS(포트 137~139)가 활성화되어 있으면,
공격자가 원격에서 **공유 자원 열거·접근**(널 세션), 계정·시스템 정보 수집이 가능.

**보안 설정(ncpa.cpl 이용)**:
시작 → 실행 → `ncpa.cpl` → 해당 연결 우클릭 → 속성 → **TCP/IPv4** 선택 → 고급 →
**WINS 탭 → "TCP/IP over NetBIOS 사용 안 함"** 선택.
추가: "Microsoft 네트워크용 파일 및 프린터 공유" 바인딩 해제, 방화벽에서 137~139/445 차단.
