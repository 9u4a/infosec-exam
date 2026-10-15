---
title: Windows 보안 — PE 구조 · 로그 경로 · NetBIOS
domain: 시스템보안
questions: [7-1, 23-1, 23-15, 28-14, 29-17, 31-5]
tags: [PE, 섹션, IIS로그, HTTPERR, DHCP, NetBIOS, ncpa.cpl, 이벤트로그]
---

## 한 줄 정의

Windows 침해 분석은 **실행 파일(PE)을 해부**하고, **로그가 어디 있는지** 알고, **네트워크 공유 통로(NetBIOS·관리 공유)를 막는** 세 축이다. 경로·포트·설정 메뉴를 정확히 외우는 문제가 많다. {{7-1}} {{23-1}} {{23-15}} {{31-5}}

## PE (Portable Executable) 구조 {{7-1}}

`.exe` `.dll` `.sys` `.ocx` 같은 Windows NT 계열 실행 파일 포맷이다.

```text
DOS 헤더 → DOS Stub → NT 헤더(Signature + File Header + Optional Header) → 섹션 헤더 → 섹션들
```

| 섹션 | 내용 |
|---|---|
| **.text** | 실행 코드(기계어) — 실행·읽기 |
| **.data** | 초기화된 전역 변수·상수 — 읽기·쓰기 |
| **.rdata** | 읽기 전용 데이터·문자열 |
| **.bss** | 초기화되지 않은 전역 변수 |
| **.idata** | Import — 사용하는 **DLL·API 목록**(IAT) |
| **.edata** | Export — DLL 이 제공하는 함수 |
| **.rsrc** | 리소스 (아이콘·버전·매니페스트) |
| **.reloc** | 재배치 정보 (ASLR·기준주소 변경 시) |

> [!시험] 악성코드 분석 단서
> `.text` **엔트로피가 높으면 패킹** 의심 · `.idata` 의 API 조합으로 행위 추정 · **EP 가 마지막 섹션·비정상 위치**면 패커/인젝션 흔적

## Windows 로그 경로 {{23-1}} {{31-5}}

| 로그 | 경로 |
|---|---|
| IIS 액세스 | `C:\inetpub\logs\LogFiles\W3SVC<n>\` (구버전 `C:\Windows\System32\LogFiles\W3SVC<n>`) |
| **HTTP 에러** | `C:\Windows\System32\LogFiles\HTTPERR\` |
| **DHCP** | `C:\Windows\System32\dhcp\` (문제 지문상 `...\LogFiles\DHCP`) |
| 방화벽 | `C:\Windows\System32\LogFiles\Firewall\pfirewall.log` |
| 이벤트(.evtx) | `C:\Windows\System32\winevt\Logs\` |

### 이벤트 로그 크기 산정 {{29-17}}

**최대 로그 크기 = 단일 이벤트 최대 크기 × 하루 최대 이벤트 수 × 보관 일수**

예) 500 B × 1,000개 × 30일 = 15,000,000 B ≈ 15,000 KB ≈ **14.3 MB**

설정: 이벤트 뷰어 → 해당 로그 → 속성 → "최대 로그 크기" + 초과 시 정책(덮어쓰기/보관)

| 이벤트 ID | 의미 |
|---|---|
| 4624 / 4625 | 로그온 성공 / 실패 |
| 4634 | 로그오프 |
| 4720 | 계정 생성 |
| 4728 | 그룹에 구성원 추가 |
| 4672 | 특수 권한 할당 |
| **1102** | **감사 로그 삭제** (침해 흔적) |

## NetBIOS · SMB 포트

| 포트 | 프로토콜 | 설명 |
|---|---|---|
| 135/TCP | RPC | 원격 프로시저 호출 |
| 137/UDP | NetBIOS | 이름 서비스 |
| 138/UDP | NetBIOS | 데이터그램 서비스 |
| 139/TCP | NetBIOS | 세션 서비스 (SMB over NetBIOS) |
| 445/TCP | SMB/CIFS | 파일·프린터 공유 (NetBIOS 없이도 동작) |

## NetBIOS 바인딩 취약점 {{23-15}} {{28-14}}

**왜 취약한가:** 인터넷에 직접 연결된 Windows 에서 TCP/IP over NetBIOS(137~139)가 켜져 있으면, 공격자가 원격에서 **공유 자원 열거·접근(널 세션)** 과 계정·시스템 정보 수집을 할 수 있다.

**설정 경로 (ncpa.cpl):**

1. 시작 → 실행 → `ncpa.cpl`
2. 해당 연결 우클릭 → 속성 → **TCP/IPv4** → 고급
3. **WINS 탭 → "TCP/IP over NetBIOS 사용 안 함"**

추가로 "Microsoft 네트워크용 파일 및 프린터 공유" 바인딩을 해제하고, 방화벽에서 137~139 / 445 를 차단한다.

## 관리 공유 (Administrative Shares) 차단

원격 관리용으로 자동 생성되는 기본 공유라 **정찰·측면 이동**에 악용된다.

| 공유 | 내용 |
|---|---|
| `C$` `D$` | 드라이브 루트 |
| `ADMIN$` | Windows 디렉터리 |
| `IPC$` | 프로세스 간 통신 — **익명 널 세션 접근 가능** |

```text
net share                 # 공유 목록
net share C$ /delete      # 즉시 삭제 (재부팅하면 재생성됨)
net session               # 연결 세션 확인
net session /delete       # 모든 세션 강제 종료

# 재부팅 후에도 영구 차단 (레지스트리)
reg add HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters ^
  /v AutoShareServer /t REG_DWORD /d 0 /f
```

> [!함정] 즉시 삭제 ≠ 영구 차단
> `net share C$ /delete` 는 **재부팅하면 되살아난다.** 영구 차단은 `AutoShareServer = 0`.

**널 세션(익명 IPC$) 차단:** `HKLM\SYSTEM\CurrentControlSet\Control\LSA` 의 `RestrictAnonymous = 2` (완전 차단, 1 은 부분 제한)

## 기출 포인트

> [!시험] 이렇게 나온다
> PE 섹션 이름 ↔ 내용 · HTTPERR / DHCP 로그 경로 · 이벤트 로그 크기 계산 · NetBIOS 끄는 메뉴 경로 · 기본 공유 영구 차단 방법 · RestrictAnonymous 값
