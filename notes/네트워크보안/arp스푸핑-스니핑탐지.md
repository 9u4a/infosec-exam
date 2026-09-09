---
title: ARP 스푸핑 & 스니핑 탐지
domain: 네트워크보안
questions: [1-16, 6-16, 13-1, 19-4, 25-17, 10-16, 19-13, 26-15, 2-9, 14-2, 22-7, 19-10, 25-4, 25-14]
tags: [ARP, 스푸핑, 스니핑, promiscuous, MITM, MAC플러딩, 세션하이재킹]
---

## ARP 동작 기본 (14-2, 22-7)

- ARP Request는 목적지 MAC을 모르므로 **브로드캐스트**로 보냄 → 목적지 MAC 필드 = **`ff:ff:ff:ff:ff:ff`** (48비트 전부 1).
- ARP Reply는 요청자에게 **유니캐스트**.
- RARP는 반대로 MAC → IP (디스크리스 단말 부팅). 지금은 BOOTP/DHCP로 대체.

## 세션 하이재킹 (19-10, 25-4)

이미 **인증을 마치고 연결된 세션**을 가로채 사용자 신원으로 서버와 통신.
- TCP 세션 하이재킹: 스니핑으로 SEQ/ACK 번호 파악 → 위조 패킷 주입, 정상 클라이언트는 ACK Storm.
- 응용: 스니핑한 **세션 쿠키·토큰** 재사용(웹).
- 대응: 구간 암호화(SSH/TLS), 세션 타임아웃·재인증, 쿠키 `Secure`/`HttpOnly`, 로그인 후 세션 ID 재발급.

## ARP 스푸핑 / 리다이렉트

- **원리**: ARP는 인증이 없어 위조된 ARP Reply(gratuitous ARP)를 무조건 캐시에 반영 → 공격자가 게이트웨이 IP에 대한 MAC을 자기 것으로 속임 → 피해자의 외부행 트래픽이 공격자 경유(**MITM**) → 감청·변조·세션 하이재킹

### 캐시 오염 절차 (MITM 완성 단계)
1. 공격자가 **피해자에게**: "게이트웨이 IP = 공격자 MAC" 이라고 위조 ARP Reply 반복 전송.
2. 공격자가 **게이트웨이에게**: "피해자 IP = 공격자 MAC" 이라고 위조 → 양방향 가로채기.
3. 공격자 호스트에서 **IP 포워딩 활성화**(`echo 1 > /proc/sys/net/ipv4/ip_forward`) → 트래픽을 실제 목적지로 중계해 피해자가 눈치채지 못하게 함.
4. 이후 스니핑·SSL stripping·세션 쿠키 탈취.
- ARP 캐시는 주기적으로 만료되므로 공격자는 위조 Reply를 **수 초 간격으로 계속** 보내야 오염이 유지된다 → 이 비정상적 ARP 트래픽 폭증이 탐지 지표.
- **판단 근거**: ARP 테이블에서 **게이트웨이 IP와 다른 IP가 같은 MAC**을 가짐 / 관리자가 아는 GW의 실제 MAC과 불일치
- 같은 MAC이 여러 IP에 → 그 MAC의 호스트가 공격자

### 대응
```bash
arp -s <게이트웨이IP> <실제MAC>     # 정적 등록 (재부팅 시 초기화 주의)
```
- 스위치: **DAI**(Dynamic ARP Inspection) + DHCP Snooping
- 암호화 통신(SSH/HTTPS)으로 감청 무력화
- ARP watch 도구로 MAC 변경 모니터링

## Promiscuous Mode (스니핑)

로그: `device eth0 entered Promiscuous mode` (`/var/log/messages`)
→ NIC가 자기 목적지가 아닌 프레임도 모두 수신 = 스니핑 도구 설치 정황

### 해제
```bash
ifconfig eth0 -promisc          # 또는 ip link set eth0 promisc off
```

## 스니핑 탐지 기법 (위조 프레임에 반응하는지 관찰)

| 방법 | 원리 |
|---|---|
| **Ping** | 대상에 IP는 맞고 **존재하지 않는 MAC**으로 ICMP Echo → 정상 NIC는 폐기, promiscuous NIC는 응답 |
| **ARP** | 위조 MAC으로 ARP 요청 → 응답하면 promiscuous |
| **DNS** | 스니퍼가 캡처한 IP를 역방향 조회하는지 관찰 |
| **Decoy** | 가짜 계정/패스워드를 평문으로 흘려 그 계정 사용 시도를 탐지 |
| **Latency** | 대량 트래픽 유발 후 응답 지연 증가 관찰 |

## 스니핑 탐지 기법 — 왜 통하는가

정상 NIC는 자기 MAC(또는 브로드캐스트·가입한 멀티캐스트)이 아닌 프레임을 **NIC 하드웨어 단계에서 폐기**한다. promiscuous 모드 NIC는 전부 커널로 올려 처리한다. 따라서 **"목적지 MAC은 틀리지만 IP는 맞는" 위조 프레임**을 보냈을 때 응답이 오면 그 호스트는 프레임을 폐기하지 않았다는 뜻 = 스니핑 중. Ping/ARP 탐지가 이 원리이고, DNS·Decoy는 스니퍼가 **잡은 내용에 반응**하는지를 본다.

## 대응 (스니핑 전반)

- 스위치 환경 + 포트 보안 (허브 금지)
- SSH·HTTPS·IPSec 등 암호화 통신
- MAC Flooding(Switch Jamming) 대비: 포트당 MAC 수 제한

## 서술형 3줄 요약 답안

- **ARP 스푸핑**: ARP 프로토콜에 인증이 없다는 점을 악용해 위조 ARP Reply로 피해자·게이트웨이의 ARP 캐시를 오염시켜 트래픽을 공격자 경유로 만드는 **MITM** 공격이다. 대응은 **정적 ARP 등록**, 스위치의 **DAI + DHCP Snooping**, 종단 암호화(HTTPS/SSH).
- **스니핑 탐지**: 정상 NIC가 폐기할 위조 프레임(틀린 MAC·정상 IP)에 응답하는지로 promiscuous 모드를 판별한다 — Ping·ARP·DNS·Decoy·Latency 기법.
- 근본 대응은 스위치 포트 보안과 **전 구간 암호화 통신**이라 스니핑에 성공해도 평문이 노출되지 않게 하는 것이다.
