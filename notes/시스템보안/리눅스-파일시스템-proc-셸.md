---
title: 리눅스 파일시스템 · /proc · 셸
domain: 시스템보안
questions: [1-12, 5-1, 8-4, 9-1, 19-3, 24-9, 28-13, 29-2]
tags: [저널링, proc, NTFS, find, race condition, 셸, hosts]
---

## 저널링 (Journaling) — 5-1

파일 시스템 작업 전에 변경 내역을 **저널(로그) 영역에 먼저 기록**하고 수행 →
비정상 종료로 손상이 나도 저널을 재생(replay)해 빠르게 복구.

- 리눅스 **ext3** 부터 지원 (ext2에는 없음), ext4·XFS·JFS·ReiserFS도 저널링.
- ext3 저널 모드: `journal`(데이터+메타데이터) / `ordered`(기본, 메타데이터만) / `writeback`.

## 윈도우 파일시스템 (29-2)

**NTFS** — 대용량 파일, **저널링**, 파일/폴더 단위 ACL(권한), 압축, **EFS 암호화**, 쿼터, ADS.
FAT32는 권한·저널·대용량(4GB↑) 미지원.

## /proc 가상 파일시스템 (8-4, 24-9)

메모리상에만 존재하는 가상 FS. 커널·프로세스 상태를 파일처럼 노출.

| 경로 | 내용 |
|---|---|
| `/proc/<PID>/exe` | 실행 파일로의 심볼릭 링크 |
| `/proc/<PID>/cmdline` | 실행 시 명령행 인자 |
| `/proc/<PID>/fd/` | 프로세스가 연 파일 디스크립터 |
| `/proc/<PID>/maps` | 메모리 매핑 (ASLR 확인) |
| `/proc/sys/net/ipv4/...` | 커널 네트워크 파라미터 (ip_forward 등) |

→ `ps` 를 믿을 수 없을 때 `ls /proc` 로 실제 실행 중 PID 목록을 확인.

## hosts 파일 (9-1)

도메인 ↔ IP 정적 매핑. DNS 질의보다 **우선**.
- Linux/Unix: `/etc/hosts`  ·  Windows: `C:\Windows\System32\drivers\etc\hosts`
- Windows 7 이상은 관리자 권한 없이는 수정 불가. 악성코드가 hosts를 변조해 파밍(정상 도메인 → 악성 IP)에 악용.

## find 활용 (1-12)

```bash
find /etc/apache/conf -type f -mtime -10     # 10일 이내 내용 변경 파일
find / -type f -mtime +365                   # 1년 이상 미변경
find / -newer /etc/passwd                     # 특정 파일보다 최근 변경
find / \( -perm -4000 -o -perm -2000 \) -type f   # SUID/SGID
find / -nouser -o -nogroup                    # 소유자 없는 파일(침해 흔적)
```
`-mtime -10` = 10일 이내, `+10` = 10일 이전, `-mmin -60` = 60분 이내.

## Race Condition (경쟁 조건) — 19-3

여러 프로세스가 공유 자원에 동시 접근할 때 **접근 순서(타이밍)** 에 따라 결과가 달라지는 상황을 악용.

- 대표: **TOCTOU** (Time-of-Check to Time-of-Use) — 검사와 사용 사이에 심볼릭 링크를 바꿔치기.
- SUID 프로그램이 임시 파일을 `/tmp` 에 예측 가능한 이름으로 생성할 때 위험.
- 대응: 파일 존재 검사 후 사용까지 원자적 연산(`O_CREAT|O_EXCL`), 임시파일 `mkstemp()`, umask 강화, 락 사용.

## 셸 (Shell) — 28-13

- **정의**: 사용자와 커널(운영체제) 사이의 명령어 해석기(인터페이스) 프로그램.
- **기능**: ① 명령어 해석·실행 ② 셸 스크립트 프로그래밍(변수·제어문) ③ 환경 설정(환경변수, 리다이렉션·파이프) ④ 작업 제어(포그라운드/백그라운드).
- 종류: sh, bash, csh, ksh, zsh. 로그인 셸은 `/etc/passwd` 7번째 필드. 계정 잠금 시 `/sbin/nologin`·`/bin/false`.
